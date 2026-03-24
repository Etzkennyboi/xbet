import { getPrice } from './market-api.js';
import { payWinner } from './gateway.js';
import { canAcceptBets } from './wallet-api.js';
import { broadcast } from './server.js';
import { loadMarkets, saveMarkets, saveBet, loadBets, clearBets, saveToHistory, addMarket, updateMarket, removeMarket } from './db.js';
import { CONFIG } from '../config.js';

let isProcessing = false;

/**
 * Creates a new prediction market for a given asset (BTC, ETH, SOL...)
 */
export async function createMarket(symbol = 'BTC', durationMinutes = CONFIG.MARKET_DURATION_MINUTES || 2) {
  if (isProcessing) return null;
  isProcessing = true;
  try {
    const startPrice = await getPrice(symbol);
    
    let targetPercent = CONFIG.TARGET_PERCENT_UP || 0.005;
    if (durationMinutes >= 60) targetPercent = 0.01;
    if (durationMinutes >= 360) targetPercent = 0.02;

    const targetPrice = startPrice * (1 + targetPercent);
    const now = Date.now();
    const durationMs = durationMinutes * 60 * 1000;
    const expiresAt = now + durationMs;
    const nonce = Math.floor(Math.random() * 10000);

    const marketId = `market_${symbol}_${durationMinutes}m_${now}_${nonce}`;
    
    let durationLabel = `${durationMinutes} minutes`;
    if (durationMinutes === 60) durationLabel = `1 hour`;
    if (durationMinutes === 360) durationLabel = `6 hours`;

    const question = `Will ${symbol} be above $${targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in ${durationLabel}?`;

    const market = {
      id: marketId,
      symbol: symbol.toUpperCase(),
      duration: durationMinutes,
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

    addMarket(market);
    // clearBets(); // DISABLED: Clearing bets is now per market resolution if needed, but bets are stored with marketId anyway

    console.log(`\n🆕 New ${symbol} Market Created: ${marketId}`);
    console.log(`   ${question}`);
    console.log(`   Closes at: ${new Date(expiresAt).toLocaleTimeString()}`);

    broadcast({ type: 'NEW_MARKET', market });
    return market;
  } finally {
    isProcessing = false;
  }
}

/**
 * Resolves a specific market by ID
 */
export async function resolveMarket(marketId) {
  if (isProcessing) return null;
  isProcessing = true;
  try {
    const markets = loadMarkets();
    const market = markets.find(m => m.id === marketId);
    
    if (!market || (market.status !== 'open' && market.status !== 'resolving')) return null;
    if (Date.now() < market.expiresAt) return null;

    market.status = 'resolving';
    updateMarket(market);
    broadcast({ type: 'MARKET_RESOLVING', market });

    console.log(`\n🔍 Resolving ${market.symbol} Market: ${market.id}...`);
    const finalPrice = await getPrice(market.symbol);
    const result = finalPrice > market.targetPrice ? 'YES' : 'NO';

    market.finalPrice = finalPrice;
    market.result = result;
    market.status = 'resolved';

    console.log(`   Final Price: $${finalPrice.toFixed(2)} -> ${result} WON`);

    const bets = loadBets(market.id); // Load bets ONLY for this market
    const winners = bets.filter(b => b.position === result);
    let payouts = [];

    for (const winner of winners) {
      const payoutAmount = Number((winner.stake * 2).toFixed(6));
      console.log(`   💸 Payout: Paying winner ${winner.wallet.slice(0, 8)}... -> $${payoutAmount.toFixed(2)}`);

      try {
        const tx = await payWinner(winner.wallet, payoutAmount);
        if (tx) {
          console.log(`   ✅ Payout confirmed: ${tx}`);
          payouts.push({
            wallet: winner.wallet,
            stake: winner.stake,
            payout: payoutAmount,
            txHash: tx,
            status: tx.startsWith('mock_') ? "SIMULATED" : "PAID"
          });
        }
      } catch (px) {
        console.error(`   ❌ Payout crash:`, px.message);
      }
      
      market.payouts = payouts;
      updateMarket(market); // Update locally 
    }

    saveToHistory(market);
    removeMarket(market.id); // Remove from active list

    broadcast({ type: 'MARKET_RESOLVED', market });
    return market;
  } finally {
    isProcessing = false;
  }
}

export async function recordEntry({ wallet, position, amount, txHash, marketId }) {
  const markets = loadMarkets();
  const market = marketId ? markets.find(m => m.id === marketId) : markets[0];
  
  if (!market || market.status !== 'open') throw new Error('No active open market');
  if (Date.now() >= market.expiresAt) throw new Error('Market has expired');

  const betAmount = parseFloat(amount);
  if (isNaN(betAmount) || betAmount < parseFloat(CONFIG.MIN_BET_USDC)) {
    throw new Error(`Minimum bet is ${CONFIG.MIN_BET_USDC} USDC`);
  }

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
  }

  updateMarket(market);

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

  console.log(`✅ Bet (${market.symbol}): ${wallet.slice(0, 6)}... -> ${position} $${betAmount}`);
  return { bet, market };
}

