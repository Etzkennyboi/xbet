import { createMarketFromPolymarket, resolveMarket, checkAndResolveExpiredMarkets } from './agent.js';
import { loadMarkets } from './db.js';

const MAX_ACTIVE_MARKETS = 3;  // Maximum number of concurrent active markets
const CHECK_INTERVAL_MS = 30000;  // Check every 30 seconds

export async function startScheduler() {
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
        
        for (let i = 0; i < needed; i++) {
          await createMarketFromPolymarket();
          // Wait between market creations to avoid rate limiting
          if (i < needed - 1) {
            await new Promise(r => setTimeout(r, 3000));
          }
        }
      } else {
        console.log(`📊 Active markets: ${activeCount}/${MAX_ACTIVE_MARKETS} (saturated)`);
      }
      
      // Log current active markets
      if (activeMarkets.length > 0) {
        console.log(`\n📋 Current Active Markets:`);
        activeMarkets.forEach((m, idx) => {
          const daysLeft = Math.ceil((m.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
          console.log(`   ${idx + 1}. "${m.question.substring(0, 60)}${m.question.length > 60 ? '...' : ''}"`);
          console.log(`      └─ Expires in ${daysLeft} days | Pool: YES $${m.yesPool.toFixed(2)} / NO $${m.noPool.toFixed(2)}`);
        });
      }
      
    } catch (err) {
      console.error('Scheduler error:', err.message);
    }
  }, CHECK_INTERVAL_MS);

  // Initial startup trigger
  setTimeout(async () => {
    console.log('\n🚀 Creating initial markets from Polymarket...');
    const activeMarkets = loadMarkets().filter(m => m.status === 'open');
    const needed = MAX_ACTIVE_MARKETS - activeMarkets.length;
    
    if (needed > 0) {
      for (let i = 0; i < needed; i++) {
        await createMarketFromPolymarket();
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    console.log('✅ Initial market creation complete\n');
  }, 2000);
}

