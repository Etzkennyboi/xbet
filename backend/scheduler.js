import { createMarket, resolveMarket } from './agent.js';
import { loadMarkets } from './db.js';

const SYMBOLS = ['BTC', 'ETH', 'SOL'];
const DURATIONS = [2, 60, 360];

export async function startScheduler() {
  console.log(`⏰ Starting Multi-Market Scheduler for: ${SYMBOLS.join(', ')}...`);

  // Continuous interval to check status of all active symbols
  setInterval(async () => {
    try {
      const activeMarkets = loadMarkets();

      for (const symbol of SYMBOLS) {
        for (const duration of DURATIONS) {
          const marketsForSymbolDuration = activeMarkets.filter(m => m.symbol === symbol && m.duration === duration);
          
          if (marketsForSymbolDuration.length === 0) {
            // Missing market for this symbol and duration
            await createMarket(symbol, duration);
          } else {
            // Check if current market has expired
            for (const market of marketsForSymbolDuration) {
              if (market.status === 'open' || market.status === 'resolving') {
                if (Date.now() >= market.expiresAt) {
                  await resolveMarket(market.id);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Scheduler error:', err.message);
    }
  }, 5000);

  // Initial startup trigger (sequential to avoid nonce/processing conflicts)
  setTimeout(async () => {
    for (const symbol of SYMBOLS) {
       for (const duration of DURATIONS) {
         const activeMarkets = loadMarkets();
         if (!activeMarkets.find(m => m.symbol === symbol && m.duration === duration)) {
           await createMarket(symbol, duration);
           await new Promise(r => setTimeout(r, 2000)); // Small gap
         }
       }
    }
  }, 2000);
}

