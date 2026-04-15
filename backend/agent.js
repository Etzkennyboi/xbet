import { payWinner } from './gateway.js';
import { canAcceptBets } from './wallet-api.js';
import { broadcast } from './server.js';
import { loadMarkets, saveMarkets, saveBet, loadBets, clearBets, saveToHistory, addMarket, updateMarket, removeMarket } from './db.js';
import { CONFIG } from '../config.js';
import { fetchPolymarketMarkets, fetchDiverseMarkets, selectBestMarket, calculateMarketMetrics } from './polymarket-api.js';
import { resolveMarketWithAI, canResolveMarket } from './ai-resolver.js';

let isProcessing = false;

/**
 * Creates 3 diverse prediction markets from Polymarket
 * Ensures one of each type: Politics, Crypto, Technology
 */
export async function createThreeDiverseMarkets() {
  if (isProcessing) return [];
  isProcessing = true;
  
  const createdMarkets = [];
  
  try {
    console.log('\n🔍 Fetching 3 diverse markets from Polymarket...');
    
    // Fetch one market from each category
    const diverseMarkets = await fetchDiverseMarkets();
    
    if (!diverseMarkets || diverseMarkets.length === 0) {
      console.log('   ⚠️ No markets available from Polymarket');
      return [];
    }
    
    // Create each market
    for (const selectedMarket of diverseMarkets) {
      const metrics = calculateMarketMetrics(selectedMarket);
      
      // Create a unique market ID for our platform
      const now = Date.now();
      const marketId = `pm_${selectedMarket.id}_${now}`;
      
      // Calculate expiry date
      const endDate = new Date(selectedMarket.endDate);
      const expiresAt = endDate.getTime();
      
      // Skip if already expired
      if (expiresAt <= now) {
        console.log(`   ⚠️ Skipping expired ${selectedMarket.category} market`);
        continue;
      }
      
      const market = {
        id: marketId,
        polymarketId: selectedMarket.id,
        polymarketConditionId: selectedMarket.conditionId,
        question: selectedMarket.question,
        description: selectedMarket.description,
        image: selectedMarket.image,
        category: selectedMarket.category,
        liquidity: selectedMarket.liquidity,
        expiresAt: expiresAt,
        endDate: selectedMarket.endDate,
        status: 'open',
        yesPool: 0,
        noPool: 0,
        yesCount: 0,
        noCount: 0,
        source: 'polymarket',
        metrics: metrics
      };
      
      addMarket(market);
      createdMarkets.push(market);
      
      console.log(`\n🆕 ${market.category.toUpperCase()} MARKET CREATED`);
      console.log(`   ID: ${marketId}`);
      console.log(`   Question: ${market.question.substring(0, 70)}${market.question.length > 70 ? '...' : ''}`);
      console.log(`   Liquidity: $${parseFloat(market.liquidity || '0').toLocaleString()}`);
      console.log(`   Expires: ${metrics.daysRemaining}d ${metrics.hoursRemaining}h`);
      
      broadcast({ type: 'NEW_MARKET', market });
      
      // Small delay between creations
      await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log(`\n✅ Created ${createdMarkets.length} diverse markets`);
    return createdMarkets;
    
  } catch (err) {
    console.error(`   ❌ Error creating markets: ${err.message}`);
    return createdMarkets;
  } finally {
    isProcessing = false;
  }
}

/**
 * Creates a single prediction market (legacy compatibility)
 */
export async function createMarketFromPolymarket() {
  const markets = await createThreeDiverseMarkets();
  return markets[0] || null;
}

/**
 * Resolves a specific market by ID using AI
 */
export async function resolveMarket(marketId) {
  if (isProcessing) return null;
  isProcessing = true;
  
  try {
    const markets = loadMarkets();
    const market = markets.find(m => m.id === marketId);
    
    if (!market || (market.status !== 'open' && market.status !== 'resolving')) {
      console.log(`   ⚠️ Market ${marketId} not found or not in open/resolving status`);
      return null;
    }
    
    // Check if market is ready for resolution
    const validation = canResolveMarket({
      endDate: market.endDate,
      expiresAt: market.expiresAt
    });
    
    if (!validation.canResolve) {
      console.log(`   ⏳ Market not yet ready for resolution: ${validation.reason}`);
      return null;
    }
    
    market.status = 'resolving';
    updateMarket(market);
    broadcast({ type: 'MARKET_RESOLVING', market });
    
    console.log(`\n🔍 AI Resolving Market: ${market.id}...`);
    console.log(`   Question: ${market.question}`);
    
    // Use AI to resolve the market
    const aiResolution = await resolveMarketWithAI({
      id: market.id,
      question: market.question,
      description: market.description,
      endDate: market.endDate,
      category: market.category
    });
    
    if (aiResolution.outcome === 'UNRESOLVED' || aiResolution.error) {
      console.log(`   ⚠️ AI could not resolve market: ${aiResolution.reasoning}`);
      market.status = 'open';
      updateMarket(market);
      return null;
    }
    
    const result = aiResolution.outcome; // 'YES' or 'NO'
    
    market.result = result;
    market.status = 'resolved';
    market.aiResolution = {
      outcome: aiResolution.outcome,
      confidence: aiResolution.confidence,
      reasoning: aiResolution.reasoning,
      resolvedAt: Date.now()
    };
    
    console.log(`   ✅ Market Resolved: ${result} WINS`);
    console.log(`   🤖 AI Confidence: ${(aiResolution.confidence * 100).toFixed(1)}%`);
    
    // Process payouts
    const bets = loadBets(market.id);
    const winners = bets.filter(b => b.position === result);
    const payouts = [];
    
    if (winners.length > 0) {
      console.log(`   💸 Processing ${winners.length} winning payouts...`);
      
      for (const winner of winners) {
        const payoutAmount = Number((winner.stake * 2).toFixed(6));
        console.log(`      → ${winner.wallet.slice(0, 8)}... : $${payoutAmount.toFixed(2)}`);
        
        try {
          const tx = await payWinner(winner.wallet, payoutAmount);
          if (tx) {
            payouts.push({
              wallet: winner.wallet,
              stake: winner.stake,
              payout: payoutAmount,
              txHash: tx,
              status: tx.startsWith('mock_') ? "SIMULATED" : "PAID"
            });
          }
        } catch (px) {
          console.error(`      ❌ Payout failed:`, px.message);
        }
      }
    } else {
      console.log(`   ℹ️ No winners for this market`);
    }
    
    market.payouts = payouts;
    
    saveToHistory(market);
    removeMarket(market.id);
    
    broadcast({ type: 'MARKET_RESOLVED', market });
    
    console.log(`\n✅ Market ${market.id} fully resolved and archived`);
    return market;
    
  } catch (err) {
    console.error(`   ❌ Error resolving market: ${err.message}`);
    return null;
  } finally {
    isProcessing = false;
  }
}

/**
 * Record a bet entry for a market
 */
export async function recordEntry({ wallet, position, amount, txHash, marketId }) {
  const markets = loadMarkets();
  const market = marketId ? markets.find(m => m.id === marketId) : markets[0];
  
  if (!market || market.status !== 'open') {
    throw new Error('No active open market');
  }
  
  if (Date.now() >= market.expiresAt) {
    throw new Error('Market has expired');
  }
  
  const betAmount = parseFloat(amount);
  if (isNaN(betAmount) || betAmount < parseFloat(CONFIG.MIN_BET_USDC)) {
    throw new Error(`Minimum bet is ${CONFIG.MIN_BET_USDC} USDC`);
  }
  
  // Check if agent can cover potential payouts
  const maxPoolAfterBet = position === 'YES'
    ? Math.max(market.yesPool + betAmount, market.noPool)
    : Math.max(market.yesPool, market.noPool + betAmount);
  
  const canCover = await canAcceptBets(maxPoolAfterBet);
  if (!canCover) {
    throw new Error('Market paused - Agent wallet balance too low to cover current risk');
  }
  
  // Update market pools
  if (position === 'YES') {
    market.yesPool += betAmount;
    market.yesCount += 1;
  } else if (position === 'NO') {
    market.noPool += betAmount;
    market.noCount += 1;
  }
  
  updateMarket(market);
  
  // Save bet
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
  
  console.log(`✅ Bet recorded: ${wallet.slice(0, 6)}... → ${position} $${betAmount} on "${market.question.substring(0, 50)}..."`);
  
  broadcast({ type: 'NEW_BET', bet, market });
  
  return { bet, market };
}

/**
 * Get current active markets
 */
export function getActiveMarkets() {
  return loadMarkets().filter(m => m.status === 'open');
}

/**
 * Check and resolve expired markets
 */
export async function checkAndResolveExpiredMarkets() {
  const markets = loadMarkets();
  const expiredMarkets = markets.filter(m => {
    if (m.status !== 'open') return false;
    return Date.now() >= m.expiresAt;
  });
  
  if (expiredMarkets.length > 0) {
    console.log(`\n⏰ Found ${expiredMarkets.length} expired market(s) to resolve`);
    
    for (const market of expiredMarkets) {
      await resolveMarket(market.id);
      // Add delay between resolutions to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  return expiredMarkets.length;
}

/**
 * Legacy function - kept for compatibility
 * Creates a simple price-based market (deprecated, use createMarketFromPolymarket)
 */
export async function createMarket(symbol = 'BTC', durationMinutes = CONFIG.MARKET_DURATION_MINUTES || 2) {
  console.log('\n⚠️ Using legacy price-based market creation. Consider using createMarketFromPolymarket() for Polymarket-style markets.');
  return createMarketFromPolymarket();
}

/**
 * Creates 3 diverse markets from Polymarket
 * One from each category: Politics, Crypto, Technology
 */
export async function createDiverseMarkets() {
  if (isProcessing) return [];
  isProcessing = true;
  
  const createdMarkets = [];
  
  try {
    console.log('\n🌍 Creating 3 diverse markets from Polymarket...');
    
    // Fetch one market from each category
    const diverseMarkets = await fetchDiverseMarkets();
    
    if (!diverseMarkets || diverseMarkets.length === 0) {
      console.log('   ⚠️ No markets fetched, using fallback samples');
      return [];
    }
    
    for (const selectedMarket of diverseMarkets) {
      const metrics = calculateMarketMetrics(selectedMarket);
      
      // Create a unique market ID for our platform
      const now = Date.now();
      const marketId = `pm_${selectedMarket.id}_${now}`;
      
      // Calculate expiry date
      const endDate = new Date(selectedMarket.endDate);
      const expiresAt = endDate.getTime();
      
      // Skip if already expired
      if (expiresAt <= now) {
        console.log(`   ⚠️ Skipping expired market: ${selectedMarket.question.substring(0, 40)}...`);
        continue;
      }
      
      const market = {
        id: marketId,
        polymarketId: selectedMarket.id,
        polymarketConditionId: selectedMarket.conditionId,
        question: selectedMarket.question,
        description: selectedMarket.description,
        image: selectedMarket.image,
        category: selectedMarket.category,
        liquidity: selectedMarket.liquidity,
        expiresAt: expiresAt,
        endDate: selectedMarket.endDate,
        status: 'open',
        yesPool: 0,
        noPool: 0,
        yesCount: 0,
        noCount: 0,
        source: 'polymarket',
        metrics: metrics
      };
      
      addMarket(market);
      createdMarkets.push(market);
      
      console.log(`\n   ✅ ${selectedMarket.category}: "${market.question.substring(0, 50)}..."`);
      console.log(`      Expires: ${metrics.daysRemaining}d ${metrics.hoursRemaining}h | Liquidity: $${parseFloat(market.liquidity || '0').toLocaleString()}`);
      
      broadcast({ type: 'NEW_MARKET', market });
    }
    
    console.log(`\n🎉 Created ${createdMarkets.length} diverse markets`);
    return createdMarkets;
    
  } catch (err) {
    console.error(`   ❌ Error creating diverse markets: ${err.message}`);
    return createdMarkets;
  } finally {
    isProcessing = false;
  }
}
