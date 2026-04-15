import TradingAgent from './TradingAgent.js';
import { loadMarkets } from '../db.js';

/**
 * Alpha Agent - Conservative Strategy
 * 
 * Characteristics:
 * - High confidence threshold (80%+)
 * - Small position sizes (1-3 USDT)
 * - Focus on arbitrage opportunities
 * - Avoids volatile markets
 * - Prioritizes markets with high liquidity
 * 
 * Philosophy: "Capital preservation over returns"
 */
export class AlphaAgent extends TradingAgent {
  constructor(index = 0) {
    super({
      name: 'Alpha',
      type: 'conservative',
      strategy: 'arbitrage',
      index: index,
      minConfidence: 0.8,
      maxPositionSize: 3,
      riskLevel: 'low',
      strategyParams: {
        minLiquidity: 50000,      // $50k minimum liquidity
        minTimeToExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxImpliedProb: 0.7,     // Don't bet on obvious outcomes
        minImpliedProb: 0.3      // Don't bet on unlikely outcomes
      }
    });
  }
  
  /**
   * Alpha's evaluation logic
   */
  async evaluateMarket(market) {
    const metrics = {
      liquidity: parseFloat(market.liquidity || '0'),
      timeToExpiry: market.expiresAt - Date.now(),
      impliedProb: this._calculateImpliedProbability(market, 'YES'),
      category: market.category || 'General'
    };
    
    // Check basic criteria
    if (metrics.liquidity < this.strategyParams.minLiquidity) {
      return {
        shouldTrade: false,
        confidence: 0,
        reasoning: `Insufficient liquidity: $${metrics.liquidity.toLocaleString()}`
      };
    }
    
    if (metrics.timeToExpiry < this.strategyParams.minTimeToExpiry) {
      return {
        shouldTrade: false,
        confidence: 0,
        reasoning: 'Market expires too soon for safe bet'
      };
    }
    
    // Alpha looks for mispriced markets
    // If implied probability is extreme, there's value in contrarian bet
    let position, confidence;
    
    if (metrics.impliedProb > this.strategyParams.maxImpliedProb) {
      // Market thinks YES is very likely - bet NO for value
      position = 'NO';
      confidence = 0.85;
    } else if (metrics.impliedProb < this.strategyParams.minImpliedProb) {
      // Market thinks YES is unlikely - bet YES for value
      position = 'YES';
      confidence = 0.85;
    } else {
      return {
        shouldTrade: false,
        confidence: 0,
        reasoning: 'No clear value opportunity'
      };
    }
    
    // Calculate position size based on confidence
    const positionSize = this._calculatePositionSize(confidence);
    
    return {
      shouldTrade: true,
      confidence: confidence,
      position: position,
      amount: positionSize,
      reasoning: `Alpha strategy: ${position} at ${(metrics.impliedProb * 100).toFixed(1)}% implied probability. Liquidity: $${metrics.liquidity.toLocaleString()}. Value opportunity detected.`
    };
  }
  
  _calculatePositionSize(confidence) {
    // Linear scale: 1-3 USDT based on confidence
    const base = 1;
    const scale = (confidence - this.minConfidence) / (1 - this.minConfidence);
    return Math.min(base + (scale * 2), this.maxPositionSize);
  }
}

export default AlphaAgent;
