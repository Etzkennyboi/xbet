/**
 * Agent Configuration
 * Specific wallet addresses and trading limits
 */

export const AGENT_CONFIG = {
  // Alpha Agent - Conservative
  alpha: {
    name: 'Alpha',
    walletAddress: '0xf33ee27249dd9f870c5fe318064065e1ffe218f9',
    maxPositionSize: 0.01, // USDT - max trade size
    maxTradesPerDay: 3,
    minConfidence: 0.8,
    riskLevel: 'low',
    strategy: 'arbitrage',
    strategyParams: {
      minLiquidity: 50000,
      minTimeToExpiry: 7 * 24 * 60 * 60 * 1000,
      maxImpliedProb: 0.7,
      minImpliedProb: 0.3
    }
  },
  
  // Sigma Agent - Aggressive
  sigma: {
    name: 'Sigma',
    walletAddress: '0x1eF1034E7Cd690B40A329bd64209Ce563F95Bb5c',
    maxPositionSize: 0.01, // USDT - max trade size
    maxTradesPerDay: 3,
    minConfidence: 0.6,
    riskLevel: 'high',
    strategy: 'momentum',
    strategyParams: {
      minPoolSize: 1000,
      momentumThreshold: 0.6,
      categoryBias: {
        'Crypto': 1.2,
        'Politics': 0.9,
        'Technology': 1.1,
        'Sports': 0.95
      }
    }
  }
};

/**
 * Check if agent can trade today
 * @param {Object} agent - Agent instance
 * @returns {Object} - Can trade status
 */
export function canTradeToday(agent) {
  const today = new Date().toDateString();
  const lastTradeDate = agent.lastTradeDate || '';
  
  if (lastTradeDate !== today) {
    // Reset daily counter for new day
    agent.dailyTrades = 0;
    agent.lastTradeDate = today;
    return { canTrade: true, remaining: agent.maxTradesPerDay };
  }
  
  const remaining = agent.maxTradesPerDay - (agent.dailyTrades || 0);
  return { canTrade: remaining > 0, remaining };
}

/**
 * Record a trade for daily tracking
 * @param {Object} agent - Agent instance
 */
export function recordDailyTrade(agent) {
  const today = new Date().toDateString();
  
  if (agent.lastTradeDate !== today) {
    agent.dailyTrades = 0;
    agent.lastTradeDate = today;
  }
  
  agent.dailyTrades = (agent.dailyTrades || 0) + 1;
  agent.lastTradeTime = Date.now();
}