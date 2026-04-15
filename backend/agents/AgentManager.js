import { AlphaAgent } from './AlphaAgent.js';
import { SigmaAgent } from './SigmaAgent.js';
import { loadAgentPerformance, saveAgentPerformance } from '../db.js';

/**
 * AgentManager - Orchestrates multiple trading agents
 * 
 * Responsibilities:
 * - Spawns agents with different strategies
 * - Coordinates agent activities
 * - Tracks global performance metrics
 * - Manages agent lifecycle (start/stop/pause)
 * - Provides leaderboard data
 */
export class AgentManager {
  constructor() {
    this.agents = new Map();
    this.isRunning = false;
    this.tradingInterval = null;
    this.leaderboardCache = null;
    this.leaderboardCacheTime = null;
    
    // Configuration
    this.config = {
      tradingIntervalMs: 30000,      // Check markets every 30 seconds
      leaderboardUpdateMs: 60000,    // Update leaderboard every minute
      maxAgents: 10,                  // Maximum concurrent agents
      minBalanceThreshold: 10         // Minimum balance to continue trading
    };
  }
  
  /**
   * Spawn a new agent
   */
  spawnAgent(type, index) {
    let agent;
    
    switch (type.toLowerCase()) {
      case 'alpha':
      case 'conservative':
        agent = new AlphaAgent(index);
        break;
        
      case 'sigma':
      case 'aggressive':
        agent = new SigmaAgent(index);
        break;
        
      default:
        console.warn(`[AgentManager] Unknown agent type: ${type}, defaulting to Alpha`);
        agent = new AlphaAgent(index);
    }
    
    // Load previous performance if exists
    const savedPerformance = loadAgentPerformance(agent.id);
    if (savedPerformance) {
      agent.performance = { ...agent.performance, ...savedPerformance };
      console.log(`[AgentManager] Loaded saved performance for ${agent.name}`);
    }
    
    this.agents.set(agent.id, agent);
    console.log(`[AgentManager] Spawned ${agent.name} (${agent.type})`);
    
    return agent;
  }
  
  /**
   * Initialize default agents
   * Exactly 2 agents: Alpha and Sigma with specific wallets
   */
  initializeDefaultAgents() {
    console.log('\n🤖 [AgentManager] Initializing 2 trading agents...');
    
    // Spawn Alpha agent (conservative)
    const alpha = new AlphaAgent();
    this._loadAndRegisterAgent(alpha);
    
    // Spawn Sigma agent (aggressive)
    const sigma = new SigmaAgent();
    this._loadAndRegisterAgent(sigma);
    
    console.log(`[AgentManager] Total agents: ${this.agents.size}`);
    console.log(`  • Alpha: ${alpha.wallet.address.slice(0, 10)}... (max 3 trades/day, 0.01 USDT/trade)`);
    console.log(`  • Sigma: ${sigma.wallet.address.slice(0, 10)}... (max 3 trades/day, 0.01 USDT/trade)\n`);
  }
  
  /**
   * Load performance and register agent
   */
  _loadAndRegisterAgent(agent) {
    // Load previous performance if exists
    const savedPerformance = loadAgentPerformance(agent.id);
    if (savedPerformance) {
      agent.performance = { ...agent.performance, ...savedPerformance };
      // Also load daily trade tracking
      if (savedPerformance.dailyTrades !== undefined) {
        agent.dailyTrades = savedPerformance.dailyTrades;
      }
      if (savedPerformance.lastTradeDate) {
        agent.lastTradeDate = savedPerformance.lastTradeDate;
      }
      console.log(`[AgentManager] Loaded saved performance for ${agent.name}`);
    }
    
    this.agents.set(agent.id, agent);
    console.log(`[AgentManager] Registered ${agent.name} (${agent.type})`);
    console.log(`[AgentManager] Total agents: ${this.agents.size}\n`);
  }
  
  /**
   * Start all agents trading
   */
  async start() {
    if (this.isRunning) {
      console.log('[AgentManager] Already running');
      return;
    }
    
    console.log('\n🚀 [AgentManager] Starting all agents...');
    
    // Activate all agents
    for (const agent of this.agents.values()) {
      if (agent.performance.currentBalance >= this.config.minBalanceThreshold) {
        agent.activate();
      } else {
        console.log(`[AgentManager] Skipping ${agent.name} - insufficient balance`);
      }
    }
    
    this.isRunning = true;
    
    // Start trading loop
    this.tradingInterval = setInterval(async () => {
      await this._tradingCycle();
    }, this.config.tradingIntervalMs);
    
    // Start leaderboard updates
    this.leaderboardInterval = setInterval(() => {
      this._updateLeaderboardCache();
    }, this.config.leaderboardUpdateMs);
    
    console.log(`[AgentManager] Trading cycle: ${this.config.tradingIntervalMs}ms`);
    console.log(`[AgentManager] Active agents: ${this.getActiveAgents().length}\n`);
  }
  
  /**
   * Stop all agents
   */
  stop() {
    if (!this.isRunning) return;
    
    console.log('\n🛑 [AgentManager] Stopping all agents...');
    
    // Clear intervals
    if (this.tradingInterval) {
      clearInterval(this.tradingInterval);
      this.tradingInterval = null;
    }
    
    if (this.leaderboardInterval) {
      clearInterval(this.leaderboardInterval);
      this.leaderboardInterval = null;
    }
    
    // Deactivate all agents
    for (const agent of this.agents.values()) {
      agent.deactivate();
      saveAgentPerformance(agent.id, agent.performance, agent.dailyTrades, agent.lastTradeDate);
    }
    
    this.isRunning = false;
    console.log('[AgentManager] All agents stopped\n');
  }
  
  /**
   * Execute one trading cycle for all active agents
   */
  async _tradingCycle() {
    const activeAgents = this.getActiveAgents();
    
    if (activeAgents.length === 0) {
      console.log('[AgentManager] No active agents to trade');
      return;
    }
    
    console.log(`\n📊 [AgentManager] Trading cycle starting... (${activeAgents.length} agents)`);
    
    // Run agents in parallel
    const tradePromises = activeAgents.map(async (agent) => {
      try {
        await agent.analyzeAndTrade();
      } catch (err) {
        console.error(`[AgentManager] Agent ${agent.name} error:`, err.message);
      }
    });
    
    await Promise.all(tradePromises);
    
    // Save performance after cycle
    for (const agent of activeAgents) {
      saveAgentPerformance(agent.id, agent.performance, agent.dailyTrades, agent.lastTradeDate);
    }
    
    console.log('[AgentManager] Trading cycle complete\n');
  }
  
  /**
   * Get active agents (have balance and are activated)
   */
  getActiveAgents() {
    return Array.from(this.agents.values()).filter(agent => 
      agent.active && agent.performance.currentBalance >= this.config.minBalanceThreshold
    );
  }
  
  /**
   * Get all agents
   */
  getAllAgents() {
    return Array.from(this.agents.values());
  }
  
  /**
   * Get agent by ID
   */
  getAgent(id) {
    return this.agents.get(id);
  }
  
  /**
   * Get leaderboard data
   */
  getLeaderboard() {
    // Return cached data if recent
    if (this.leaderboardCache && this.leaderboardCacheTime) {
      const age = Date.now() - this.leaderboardCacheTime;
      if (age < 30000) { // 30 second cache
        return this.leaderboardCache;
      }
    }
    
    return this._updateLeaderboardCache();
  }
  
  /**
   * Update and cache leaderboard
   */
  _updateLeaderboardCache() {
    const agents = Array.from(this.agents.values());
    
    // Calculate rankings
    const rankings = agents.map(agent => {
      const perf = agent.performance;
      return {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        strategy: agent.strategy,
        riskLevel: agent.riskLevel,
        wallet: agent.wallet.address,
        active: agent.active,
        // Performance metrics
        totalTrades: perf.totalTrades,
        winRate: perf.winRate,
        totalProfit: perf.totalProfit,
        totalLoss: perf.totalLoss,
        netProfit: perf.totalProfit - perf.totalLoss,
        currentBalance: perf.currentBalance,
        roi: perf.roi,
        sharpeRatio: perf.sharpeRatio,
        maxDrawdown: perf.maxDrawdown,
        // Current positions
        activePositions: perf.currentPositions?.length || 0,
        // Ranking score (combination of profit and consistency)
        score: this._calculateScore(perf)
      };
    });
    
    // Sort by score (descending)
    rankings.sort((a, b) => b.score - a.score);
    
    // Add rank
    rankings.forEach((r, i) => r.rank = i + 1);
    
    // Calculate summary stats
    const summary = {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.active).length,
      totalPnL: rankings.reduce((sum, r) => sum + r.netProfit, 0),
      bestPerformer: rankings[0]?.name || 'N/A',
      worstPerformer: rankings[rankings.length - 1]?.name || 'N/A',
      avgWinRate: rankings.reduce((sum, r) => sum + r.winRate, 0) / rankings.length || 0,
      lastUpdated: new Date().toISOString()
    };
    
    this.leaderboardCache = {
      rankings: rankings,
      summary: summary
    };
    
    this.leaderboardCacheTime = Date.now();
    
    return this.leaderboardCache;
  }
  
  /**
   * Calculate performance score for ranking
   */
  _calculateScore(performance) {
    // Weighted scoring system
    const weights = {
      netProfit: 0.4,
      winRate: 0.2,
      sharpeRatio: 0.2,
      consistency: 0.2  // Based on max drawdown
    };
    
    const netProfit = performance.totalProfit - performance.totalLoss;
    const normalizedProfit = Math.max(0, netProfit) / 100; // Normalize to 0-1 scale
    const winRate = performance.winRate;
    const sharpeRatio = Math.max(0, performance.sharpeRatio);
    const consistency = Math.max(0, 1 - performance.maxDrawdown);
    
    return (
      normalizedProfit * weights.netProfit +
      winRate * weights.winRate +
      sharpeRatio * weights.sharpeRatio +
      consistency * weights.consistency
    );
  }
  
  /**
   * Pause an agent
   */
  pauseAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.active = false;
      console.log(`[AgentManager] Paused ${agent.name}`);
    }
  }
  
  /**
   * Resume an agent
   */
  resumeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.active = true;
      console.log(`[AgentManager] Resumed ${agent.name}`);
    }
  }
  
  /**
   * Remove an agent
   */
  removeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.deactivate();
      this.agents.delete(agentId);
      console.log(`[AgentManager] Removed ${agent.name}`);
    }
  }
  
  /**
   * Get system status
   */
  getStatus() {
    return {
      running: this.isRunning,
      totalAgents: this.agents.size,
      activeAgents: this.getActiveAgents().length,
      config: this.config
    };
  }
}

export default AgentManager;
