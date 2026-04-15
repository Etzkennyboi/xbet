import TradingAgent from './TradingAgent.js';
import { loadMarkets } from '../db.js';

/**
 * Alpha Agent - Conservative Strategy
 * 
 * Characteristics:
 * - High confidence threshold (80%+)
 * - Fixed position size: 0.01 USDT per trade
 * - Maximum 3 trades per day
 * - Focus on arbitrage opportunities
 * - Avoids volatile markets
 * 
 * Philosophy: "Capital preservation over returns"
 */
export class AlphaAgent extends TradingAgent {
  constructor() {
    super({
      name: 'Alpha',
      type: 'conservative',
      strategy: 'arbitrage',
      walletAddress: '0xf33ee27249dd9f870c5fe318064065e1ffe218f9', // Specific wallet
      minConfidence: 0.8,
      maxPositionSize: 0.01, // Fixed: 0.01 USDT max per trade
      maxTradesPerDay: 3, // Fixed: max 3 trades per day
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
   * Only trades if within daily limit
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
    
    return {
      shouldTrade: true,
      confidence: confidence,
      position: position,
      amount: this.maxPositionSize, // Fixed: 0.01 USDT
      reasoning: `Alpha strategy: ${position} at ${(metrics.impliedProb * 100).toFixed(1)}% implied probability. Trade ${tradeStatus.remaining} of ${this.maxTradesPerDay} today.`
    };
  }
}

export default AlphaAgent;
