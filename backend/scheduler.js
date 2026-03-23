import { createMarket, resolveMarket } from './agent.js';
import { loadMarket } from './db.js';

export async function startScheduler() {
  console.log('⏰ Starting 5-minute Market Scheduler...');
  
  // Continuous 5-second interval to check state
  setInterval(async () => {
    try {
      const market = loadMarket();
      
      if (!market || market.status === 'resolved') {
        // Time to create a new market
        await createMarket();
      } else if (market.status === 'open' || market.status === 'resolving') {
        // Check if current market has expired
        if (Date.now() >= market.expiresAt) {
          await resolveMarket();
        }
      }
    } catch (err) {
      console.error('Scheduler error:', err.message);
    }
  }, 5000);

  // Initial startup trigger
  setTimeout(async () => {
    try {
      const market = loadMarket();
      if (!market || market.status === 'resolved') {
        await createMarket();
      }
    } catch (err) {
      console.error('Initial market creation failed:', err.message);
    }
  }, 2000);
}
