import { ethers } from 'ethers';
import { loadMarkets, loadBets, addMarket, updateMarket } from '../db.js';
import { fetchPolymarketMarkets, calculateMarketMetrics } from '../polymarket-api.js';
import { resolveMarketWithAI } from '../ai-resolver.js';
import { CONFIG } from '../../config.js';

/**
 * Base Agent Class - All trading agents extend this
 * Handles common functionality: wallet management, trade execution, P&L tracking
 */
export class TradingAgent {
  constructor(config) {
    this.id = config.id || `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = config.name || 'Unnamed Agent';
    this.type = config.type || 'base';
    this.strategy = config.strategy || 'conservative';
    
    // Wallet setup - each agent has its own wallet derived from master seed
    this.wallet = this._deriveWallet(config.index || 0);
    
    // Trading parameters
    this.minConfidence = config.minConfidence || 0.6;
    this.maxPositionSize = config.maxPositionSize || 10; // USDT
    this.riskLevel = config.riskLevel || 'medium'; // low, medium, high
    
    // Performance tracking
    this.performance = {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      currentBalance: 100, // Starting balance in USDT
      maxDrawdown: 0,
      peakBalance: 100,
      winRate: 0,
      roi: 0,
      sharpeRatio: 0,
      tradeHistory: []
    };
    
    // Agent state
    this.active = false;
    this.lastTradeTime = null;
    this.currentPositions = []; // Active bets
    
    // Strategy-specific parameters
    this.strategyParams = config.strategyParams || {};
  }
  
  _deriveWallet(index) {
    // Derive wallet from master seed + index for deterministic addresses
    const masterKey = process.env.AGENT_MASTER_KEY || process.env.PRIVATE_KEY;
    if (!masterKey) {
      console.warn(`[Agent ${this.name}] No master key configured, using random wallet`);
      return ethers.Wallet.createRandom();
    }
    
    const hdNode = ethers.HDNodeWallet.fromSeed(ethers.sha256(ethers.toUtf8Bytes(masterKey)));
    return hdNode.derivePath(`m/44'/60'/${index}'/0/0`);
  }
  
  /**
   * Main trading loop - analyzes markets and makes decisions
   * Override this method in subclasses for specific strategies
   */
  async analyzeAndTrade() {
    if (!this.active) return;
    
    try {
      const markets = await this._fetchOpportunities();
      
      for (const market of markets) {
        const decision = await this.evaluateMarket(market);
        
        if (decision.shouldTrade && decision.confidence >= this.minConfidence) {
          await this.executeTrade(market, decision);
        }
      }
      
      // Check and claim resolved positions
      await this.checkResolvedPositions();
      
    } catch (err) {
      console.error(`[Agent ${this.name}] Trading error:`, err.message);
    }
  }
  
  /**
   * Fetch potential trading opportunities
   * Can be overridden by subclasses
   */
  async _fetchOpportunities() {
    // Get active markets from our platform
    const localMarkets = loadMarkets().filter(m => m.status === 'open');
    
    // Also check Polymarket for new markets
    const polymarketMarkets = await fetchPolymarketMarkets(10, true);
    
    return localMarkets;
  }
  
  /**
   * Evaluate a market and decide whether to trade
   * OVERRIDE THIS in subclasses for different strategies
   */
  async evaluateMarket(market) {
    // Base implementation - requires override
    return {
      shouldTrade: false,
      confidence: 0,
      position: null, // 'YES' or 'NO'
      amount: 0,
      reasoning: 'Base class - no strategy implemented'
    };
  }
  
  /**
   * Execute a trade
   */
  async executeTrade(market, decision) {
    try {
      console.log(`\n🤖 [Agent ${this.name}] Executing trade:`);
      console.log(`   Market: ${market.question.substring(0, 60)}...`);
      console.log(`   Position: ${decision.position} | Amount: $${decision.amount}`);
      console.log(`   Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      console.log(`   Reasoning: ${decision.reasoning}`);
      
      // Check if we have enough balance
      if (this.performance.currentBalance < decision.amount) {
        console.log(`   ❌ Insufficient balance: $${this.performance.currentBalance}`);
        return;
      }
      
      // Record the trade
      const trade = {
        id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        agentId: this.id,
        marketId: market.id,
        marketQuestion: market.question,
        position: decision.position,
        amount: decision.amount,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        timestamp: Date.now(),
        status: 'active',
        entryPrice: this._calculateImpliedProbability(market, decision.position)
      };
      
      // Update balance (deduct stake)
      this.performance.currentBalance -= decision.amount;
      this.performance.totalTrades++;
      this.currentPositions.push(trade);
      
      console.log(`   ✅ Trade executed: ${trade.id}`);
      console.log(`   💰 Balance: $${this.performance.currentBalance.toFixed(2)}`);
      
      return trade;
      
    } catch (err) {
      console.error(`   ❌ Trade failed:`, err.message);
    }
  }
  
  /**
   * Calculate implied probability from pool sizes
   */
  _calculateImpliedProbability(market, position) {
    const totalPool = (market.yesPool || 0) + (market.noPool || 0);
    if (totalPool === 0) return 0.5;
    
    return position === 'YES' 
      ? (market.yesPool || 0) / totalPool
      : (market.noPool || 0) / totalPool;
  }
  
  /**
   * Check if any positions have been resolved
   */
  async checkResolvedPositions() {
    const markets = loadMarkets();
    
    for (const position of this.currentPositions) {
      const market = markets.find(m => m.id === position.marketId);
      
      if (market && market.status === 'resolved') {
        await this._processResolution(position, market);
      }
    }
  }
  
  /**
   * Process a resolved position
   */
  async _processResolution(position, market) {
    const won = market.result === position.position;
    
    if (won) {
      // Calculate payout (original stake + share of loser pool)
      const loserPool = position.position === 'YES' 
        ? (market.noPool || 0) 
        : (market.yesPool || 0);
      const winnerPool = position.position === 'YES'
        ? (market.yesPool || 0)
        : (market.noPool || 0);
      
      // Payout formula: stake + (loserPool * (stake / winnerPool))
      const payout = position.amount + (loserPool * (position.amount / winnerPool));
      const profit = payout - position.amount;
      
      this.performance.currentBalance += payout;
      this.performance.totalProfit += profit;
      this.performance.winningTrades++;
      position.status = 'won';
      position.payout = payout;
      position.profit = profit;
      
      console.log(`\n🎉 [Agent ${this.name}] WON trade!`);
      console.log(`   Profit: $${profit.toFixed(2)} | Payout: $${payout.toFixed(2)}`);
      
    } else {
      this.performance.totalLoss += position.amount;
      this.performance.losingTrades++;
      position.status = 'lost';
      position.profit = -position.amount;
      
      console.log(`\n💸 [Agent ${this.name}] Lost trade: -$${position.amount}`);
    }
    
    // Update metrics
    this._updateMetrics();
    
    // Remove from active positions
    this.currentPositions = this.currentPositions.filter(p => p.id !== position.id);
    this.performance.tradeHistory.push(position);
  }
  
  /**
   * Update performance metrics
   */
  _updateMetrics() {
    const { totalTrades, winningTrades, totalProfit, totalLoss, currentBalance, peakBalance } = this.performance;
    
    this.performance.winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
    this.performance.roi = (totalProfit - totalLoss) / (totalProfit + totalLoss + 100) * 100;
    
    // Update peak and drawdown
    if (currentBalance > peakBalance) {
      this.performance.peakBalance = currentBalance;
    }
    const drawdown = (peakBalance - currentBalance) / peakBalance;
    if (drawdown > this.performance.maxDrawdown) {
      this.performance.maxDrawdown = drawdown;
    }
    
    // Calculate Sharpe ratio (simplified)
    const returns = this.performance.tradeHistory.map(t => t.profit || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length || 0;
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - avgReturn, 2), 0) / returns.length || 1;
    const stdDev = Math.sqrt(variance);
    this.performance.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
  }
  
  /**
   * Activate the agent
   */
  activate() {
    this.active = true;
    console.log(`\n✅ [Agent ${this.name}] Activated with $${this.performance.currentBalance} USDT`);
    console.log(`   Strategy: ${this.strategy} | Risk: ${this.riskLevel}`);
    console.log(`   Wallet: ${this.wallet.address.slice(0, 10)}...`);
  }
  
  /**
   * Deactivate the agent
   */
  deactivate() {
    this.active = false;
    console.log(`\n🛑 [Agent ${this.name}] Deactivated`);
    console.log(`   Final Balance: $${this.performance.currentBalance.toFixed(2)}`);
    console.log(`   Total P&L: $${(this.performance.totalProfit - this.performance.totalLoss).toFixed(2)}`);
  }
  
  /**
   * Get agent statistics for leaderboard
   */
  getStats() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      strategy: this.strategy,
      riskLevel: this.riskLevel,
      active: this.active,
      wallet: this.wallet.address,
      performance: {
        ...this.performance,
        netProfit: this.performance.totalProfit - this.performance.totalLoss,
        currentPositions: this.currentPositions.length
      },
      lastTradeTime: this.lastTradeTime
    };
  }
}

export default TradingAgent;
