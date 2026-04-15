import TradingAgent from './TradingAgent.js';

/**
 * Sigma Agent - Aggressive Strategy
 * 
 * Characteristics:
 * - Lower confidence threshold (60%+)
 * - Larger position sizes (5-15 USDT)
 * - Momentum-based trading
 * - Follows the money (majority bet)
 * - Short-term focus
 * 
 * Philosophy: "Ride the wave, cut losses quickly"
 */
export class SigmaAgent extends TradingAgent {
  constructor(index = 1) {
    super({
      name: 'Sigma',
      type: 'aggressive',
      strategy: 'momentum',
      index: index,
      minConfidence: 0.6,
      maxPositionSize: 15,
      riskLevel: 'high',
      strategyParams: {
        minPoolSize: 1000,       // Minimum total pool
        momentumThreshold: 0.6,  // Follow if >60% betting one way
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
  }
  
  /**
   * Sigma's evaluation logic
   */
  async evaluateMarket(market) {
    const metrics = this._analyzeMarket(market);
    
    // Check minimum pool size
    if (metrics.totalPool < this.strategyParams.minPoolSize) {
      return {
        shouldTrade: false,
        confidence: 0,
        reasoning: `Pool too small: $${metrics.totalPool}`
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
    const categoryBias = this.strategyParams.categoryBias[market.category] || 1.0;
    const adjustedConfidence = Math.min(momentum.strength * categoryBias, 0.95);
    
    if (adjustedConfidence < this.minConfidence) {
      return {
        shouldTrade: false,
        confidence: adjustedConfidence,
        reasoning: 'Confidence below threshold after category adjustment'
      };
    }
    
    // Calculate position size - Sigma goes big on momentum
    const positionSize = this._calculatePositionSize(adjustedConfidence, metrics.totalPool);
    
    return {
      shouldTrade: true,
      confidence: adjustedConfidence,
      position: momentum.direction,
      amount: positionSize,
      reasoning: `Sigma strategy: Following ${momentum.direction} momentum at ${(momentum.strength * 100).toFixed(1)}% strength. Pool: $${metrics.totalPool.toLocaleString()}. Category: ${market.category}.`
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
  
  _calculatePositionSize(confidence, poolSize) {
    // Sigma scales position with confidence and pool size
    // Higher confidence + larger pool = bigger bet
    const baseSize = 5;
    const confidenceMultiplier = (confidence - this.minConfidence) / (1 - this.minConfidence);
    const poolMultiplier = Math.min(poolSize / 10000, 1); // Cap at 10k pool size
    
    const size = baseSize + (confidenceMultiplier * 7) + (poolMultiplier * 3);
    return Math.min(size, this.maxPositionSize);
  }
}

export default SigmaAgent;
