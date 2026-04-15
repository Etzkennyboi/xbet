import TradingAgent from './TradingAgent.js';

/**
 * Sigma Agent - Aggressive Strategy
 * 
 * Characteristics:
 * - Lower confidence threshold (60%+)
 * - Fixed position size: 0.01 USDT per trade
 * - Maximum 3 trades per day across different market types
 * - Momentum-based trading
 * - Follows the money (majority bet)
 * - Diversifies across Politics, Crypto, and Technology markets
 * 
 * Philosophy: "Ride the wave, cut losses quickly"
 */
export class SigmaAgent extends TradingAgent {
  constructor() {
    super({
      name: 'Sigma',
      type: 'aggressive',
      strategy: 'momentum',
      walletAddress: '0x1eF1034E7Cd690B40A329bd64209Ce563F95Bb5c', // Specific wallet
      minConfidence: 0.6,
      maxPositionSize: 0.01, // Fixed: 0.01 USDT max per trade
      maxTradesPerDay: 3, // Fixed: max 3 trades per day
      riskLevel: 'high',
      strategyParams: {
        minPoolSize: 1000,       // Minimum total pool
        momentumThreshold: 0.6,  // Follow if >60% betting one way
        preferredCategories: ['Politics', 'Crypto', 'Technology'], // Trade across all types
        categoryBias: {
          'Crypto': 1.2,         // 20% more confident in crypto
          'Politics': 0.9,       // 10% less confident in politics
          'Technology': 1.1,     // 10% more confident in tech
          'Sports': 0.95         // 5% less confident in sports
        }
      }
    });
    
    // Sigma tracks market sentiment
    this.sentimentCache = new Map();
    
    // Track which categories have been traded today
    this.tradedCategories = new Set();
  }
  
  /**
   * Sigma's evaluation logic
   * Prioritizes trading on different market types for diversification
   */
  async evaluateMarket(market) {
    // Check daily trade limit first
    const tradeStatus = this.canTradeToday();
    if (!tradeStatus.canTrade) {
      return {
        shouldTrade: false,
        confidence: 0,
        reasoning: `Daily trade limit reached (${this.maxTradesPerDay}/day)`
      };
    }
    
    const metrics = this._analyzeMarket(market);
    
    // Check minimum pool size
    if (metrics.totalPool < this.strategyParams.minPoolSize) {
      return {
        shouldTrade: false,
        confidence: 0,
        reasoning: `Pool too small: $${metrics.totalPool}`
      };
    }
    
    // Check if we've already traded this category today
    const category = market.category || 'General';
    const alreadyTradedThisCategory = this.tradedCategories.has(category);
    if (alreadyTradedThisCategory && this.dailyTrades >= 2) {
      return {
        shouldTrade: false,
        confidence: 0,
        reasoning: `Already traded ${category} today, waiting for different category`
      };
    }
    
    // Calculate momentum
    const momentum = this._calculateMomentum(market);
    if (momentum.strength < this.strategyParams.momentumThreshold) {
      return {
        shouldTrade: false,
        confidence: 0,
        reasoning: 'No clear momentum detected'
      };
    }
    
    // Apply category bias
    const categoryBias = this.strategyParams.categoryBias[category] || 1.0;
    const adjustedConfidence = Math.min(momentum.strength * categoryBias, 0.95);
    
    if (adjustedConfidence < this.minConfidence) {
      return {
        shouldTrade: false,
        confidence: adjustedConfidence,
        reasoning: 'Confidence below threshold after category adjustment'
      };
    }
    
    // Record this category as traded
    this.tradedCategories.add(category);
    
    return {
      shouldTrade: true,
      confidence: adjustedConfidence,
      position: momentum.direction,
      amount: this.maxPositionSize, // Fixed: 0.01 USDT
      reasoning: `Sigma strategy: Following ${momentum.direction} momentum on ${category}. Trade ${tradeStatus.remaining} of ${this.maxTradesPerDay} today. Categories: ${Array.from(this.tradedCategories).join(', ')}`
    };
  }
  
  _analyzeMarket(market) {
    const yesPool = market.yesPool || 0;
    const noPool = market.noPool || 0;
    const totalPool = yesPool + noPool;
    
    return {
      yesPool,
      noPool,
      totalPool,
      yesRatio: totalPool > 0 ? yesPool / totalPool : 0.5,
      noRatio: totalPool > 0 ? noPool / totalPool : 0.5,
      recentActivity: this._getRecentActivity(market.id)
    };
  }
  
  _calculateMomentum(market) {
    const metrics = this._analyzeMarket(market);
    
    // If one side has significantly more bets, that's momentum
    const dominantRatio = Math.max(metrics.yesRatio, metrics.noRatio);
    const direction = metrics.yesRatio > metrics.noRatio ? 'YES' : 'NO';
    
    // Check recent activity - accelerating momentum?
    const recentActivity = metrics.recentActivity;
    const momentumBoost = recentActivity > 0 ? Math.min(recentActivity / 1000, 0.1) : 0;
    
    return {
      direction: direction,
      strength: Math.min(dominantRatio + momentumBoost, 0.95),
      dominantRatio: dominantRatio,
      recentActivity: recentActivity
    };
  }
  
  _getRecentActivity(marketId) {
    // Check if there's been recent betting activity
    // This would ideally query recent bets from DB
    // For now, simplified
    return 0;
  }
  
  /**
   * Override recordDailyTrade to reset category tracking on new day
   */
  recordDailyTrade() {
    const today = new Date().toDateString();
    
    if (this.lastTradeDate !== today) {
      this.dailyTrades = 0;
      this.lastTradeDate = today;
      this.tradedCategories.clear(); // Reset category tracking
    }
    
    this.dailyTrades++;
    this.lastTradeTime = Date.now();
  }
}

export default SigmaAgent;
