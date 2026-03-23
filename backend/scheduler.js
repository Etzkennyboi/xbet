import { createMarket, resolveMarket } from './agent.js';
import { loadMarkets } from './db.js';

const SYMBOLS = ['BTC', 'ETH', 'SOL'];

export async function startScheduler() {
  console.log(`⏰ Starting Multi-Market Scheduler for: ${SYMBOLS.join(', ')}...`);

  // Continuous interval to check status of all active symbols
  setInterval(async () => {
    try {
      const activeMarkets = loadMarkets();

      for (const symbol of SYMBOLS) {
        const market = activeMarkets.find(m => m.symbol === symbol);

        if (!market) {
          // Missing market for this symbol
          await createMarket(symbol);
        } else if (market.status === 'open' || market.status === 'resolving') {
          // Check if current market has expired
          if (Date.now() >= market.expiresAt) {
            await resolveMarket(market.id);
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
      const activeMarkets = loadMarkets();
      if (!activeMarkets.find(m => m.symbol === symbol)) {
        await createMarket(symbol);
        await new Promise(r => setTimeout(r, 2000)); // Small gap
      }
    }
  }, 2000);
}

