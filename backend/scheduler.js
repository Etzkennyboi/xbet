import { createDiverseMarkets, checkAndResolveExpiredMarkets } from './agent.js';
import { loadMarkets } from './db.js';
import { AgentManager } from './agents/index.js';

const MAX_ACTIVE_MARKETS = 3;  // Maximum number of concurrent active markets
const CHECK_INTERVAL_MS = 30000;  // Check every 30 seconds

// Global agent manager instance (shared with server.js)
let agentManager = null;

export async function startScheduler(agentMgr) {
  // Accept agent manager from server.js if provided
  if (agentMgr) {
    agentManager = agentMgr;
  }
  
  // Start agent manager if not already running
  if (agentManager && !agentManager.isRunning) {
    agentManager.start();
  }
  
  console.log(`⏰ Starting Polymarket AI-Resolved Prediction Market Scheduler...`);
  console.log(`   Max active markets: ${MAX_ACTIVE_MARKETS}`);
  console.log(`   Check interval: ${CHECK_INTERVAL_MS / 1000}s`);

  // Continuous interval to check market status and create new ones
  setInterval(async () => {
    try {
      // First, check and resolve any expired markets
      await checkAndResolveExpiredMarkets();
      
      // Then check if we need to create new markets
      const activeMarkets = loadMarkets().filter(m => m.status === 'open');
      const activeCount = activeMarkets.length;
      
      if (activeCount < MAX_ACTIVE_MARKETS) {
        const needed = MAX_ACTIVE_MARKETS - activeCount;
        console.log(`\n📊 Active markets: ${activeCount}/${MAX_ACTIVE_MARKETS}. Creating ${needed} new market(s)...`);
        
        // Create diverse markets (one from each category)
        await createDiverseMarkets();
        
      } else {
        console.log(`📊 Active markets: ${activeCount}/${MAX_ACTIVE_MARKETS} (saturated)`);
      }
      
      // Log current active markets with categories
      if (activeMarkets.length > 0) {
        console.log(`\n📋 Current Active Markets:`);
        
        // Group by category
        const byCategory = {};
        activeMarkets.forEach(m => {
          const cat = m.category || 'General';
          if (!byCategory[cat]) byCategory[cat] = [];
          byCategory[cat].push(m);
        });
        
        Object.entries(byCategory).forEach(([cat, markets]) => {
          console.log(`   📂 ${cat}:`);
          markets.forEach((m, idx) => {
            const daysLeft = Math.ceil((m.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
            console.log(`      ${idx + 1}. "${m.question.substring(0, 50)}${m.question.length > 50 ? '...' : ''}"`);
            console.log(`         └─ Expires in ${daysLeft}d | Pool: YES $${(m.yesPool || 0).toFixed(2)} / NO $${(m.noPool || 0).toFixed(2)}`);
          });
        });
      }
      
    } catch (err) {
      console.error('Scheduler error:', err.message);
    }
  }, CHECK_INTERVAL_MS);

  // Initial startup trigger
  setTimeout(async () => {
    console.log('\n🚀 Creating initial diverse markets from Polymarket...');
    const activeMarkets = loadMarkets().filter(m => m.status === 'open');
    
    if (activeMarkets.length < MAX_ACTIVE_MARKETS) {
      await createDiverseMarkets();
    }
    
    console.log('✅ Initial market creation complete\n');
  }, 2000);
}

export default startScheduler;
