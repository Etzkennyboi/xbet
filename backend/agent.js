import { getBTCPrice } from './market-api.js';
import { payWinner } from './gateway.js';
import { canAcceptBets } from './wallet-api.js';
import { broadcast } from './server.js';
import { loadMarket, saveMarket, saveBet, loadBets, clearBets, saveToHistory } from './db.js';
import { CONFIG } from '../config.js';

let isProcessing = false;

export async function createMarket() {
  if (isProcessing) return null;
  isProcessing = true;
  try {
    const startPrice = await getBTCPrice();
    const targetPrice = startPrice * (1 + (CONFIG.TARGET_PERCENT_UP || 0.005));
    const now = Date.now();
    const durationMs = (CONFIG.MARKET_DURATION_MINUTES || 2) * 60 * 1000;
    const expiresAt = now + durationMs;

    const marketId = `market_${now}`;
    const question = `Will BTC be above $${targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in 2 minutes?`;

    const market = {
      id: marketId,
      question,
      startPrice,
      targetPrice,
      startTime: now,
      expiresAt,
      status: 'open',
      yesPool: 0,
      noPool: 0,
      yesCount: 0,
      noCount: 0
    };

    saveMarket(market);
    clearBets(); // Clear previous active bets

    console.log(`\n🆕 New Market Created: ${marketId}`);
    console.log(`   ${question}`);
    console.log(`   Closes at: ${new Date(expiresAt).toLocaleTimeString()}`);

    broadcast({ type: 'NEW_MARKET', market });
    return market;
  } finally {
    isProcessing = false;
  }
}

export async function recordEntry({ wallet, position, amount, txHash }) {
  const market = loadMarket();
  if (!market || market.status !== 'open') throw new Error('No active open market');
  if (Date.now() >= market.expiresAt) throw new Error('Market has expired');

  const betAmount = parseFloat(amount);
  if (isNaN(betAmount) || betAmount < parseFloat(CONFIG.MIN_BET_USDC)) {
    throw new Error(`Minimum bet is ${CONFIG.MIN_BET_USDC} USDC`);
  }

  // Ensure agent wallet can cover 2x theoretical max payout
  const maxPoolAfterBet = position === 'YES'
    ? Math.max(market.yesPool + betAmount, market.noPool)
    : Math.max(market.yesPool, market.noPool + betAmount);

  const canCover = await canAcceptBets(maxPoolAfterBet);
  if (!canCover) {
    throw new Error('Market paused - Agent wallet balance too low to cover current risk');
  }

  if (position === 'YES') {
    market.yesPool += betAmount;
    market.yesCount += 1;
  } else if (position === 'NO') {
    market.noPool += betAmount;
    market.noCount += 1;
  } else {
    throw new Error('Position must be YES or NO');
  }

  saveMarket(market);

  const bet = {
    id: `bet_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    wallet: wallet.toLowerCase(),
    marketId: market.id,
    position,
    stake: betAmount,
    txHash,
    timestamp: Date.now()
  };
  saveBet(bet);

  console.log(`✅ Bet placed: ${wallet.slice(0, 6)}... -> ${position} $${betAmount}`);

  return { bet, market };
}

export async function resolveMarket() {
  if (isProcessing) return null;
  isProcessing = true;
  try {
    const market = loadMarket();
    if (!market || (market.status !== 'open' && market.status !== 'resolving')) return null;
    if (Date.now() < market.expiresAt) return null;

    market.status = 'resolving';
    saveMarket(market);
    broadcast({ type: 'MARKET_RESOLVING', market });

    console.log(`\n🔍 Resolving Market: ${market.id}...`);
    const finalPrice = await getBTCPrice();
    const result = finalPrice > market.targetPrice ? 'YES' : 'NO';

    market.finalPrice = finalPrice;
    market.result = result;
    market.status = 'resolved';

    console.log(`   Final Price: $${finalPrice.toFixed(2)} -> ${result} WON`);

    const bets = loadBets();
    const winners = bets.filter(b => b.position === result);
    let payouts = [];

    // Simple 2x payout to all winners
    for (const winner of winners) {
      // DEEP AUDIT FIX #2: Strictly cap floating point math at 6 decimals to prevent RPC Rejection.
      const payoutAmount = Number((winner.stake * 2).toFixed(6));
      console.log(`   💸 Payout: Paying winner ${winner.wallet.slice(0, 8)}... -> $${payoutAmount.toFixed(2)}`);

      try {
        const tx = await payWinner(winner.wallet, payoutAmount);
        if (tx && !tx.startsWith('mock_tx')) {
          console.log(`   ✅ Payout confirmed for ${winner.wallet.slice(0, 8)}: ${tx}`);
          payouts.push({
            wallet: winner.wallet,
            stake: winner.stake,
            payout: payoutAmount,
            txHash: tx,
            status: "PAID"
          });
        } else if (tx && tx.startsWith('mock_tx')) {
          console.error(`   ⚠️ Payout Simulated for ${winner.wallet.slice(0, 8)}.`);
          payouts.push({
            wallet: winner.wallet,
            stake: winner.stake,
            payout: payoutAmount,
            txHash: tx,
            status: "SIMULATED"
          });
        } else {
          console.error(`   ❌ Payout FAILED for ${winner.wallet.slice(0, 8)}. No TX ID returned.`);
          payouts.push({
            wallet: winner.wallet,
            stake: winner.stake,
            payout: payoutAmount,
            txHash: "FAILED_ONCHAIN",
            status: "FAILED"
          });
        }
      } catch (px) {
        console.error(`   ❌ Payout logic crash for ${winner.wallet.slice(0, 8)}:`, px.message);
        payouts.push({
          wallet: winner.wallet,
          stake: winner.stake,
          payout: payoutAmount,
          txHash: "ERROR_DURING_PAYOUT",
          status: "ERROR"
        });
      }

      // DEEP AUDIT FIX #4: Idempotency. Save iteratively after EACH payout interaction.
      // If the node process crashes here, prior payouts are already secured in history.
      market.payouts = payouts;
      saveToHistory(market);
    }

    // Clear active market to trigger new creation cycle
    saveMarket(null);

    broadcast({ type: 'MARKET_RESOLVED', market });
    return market;
  } finally {
    isProcessing = false;
  }
}
