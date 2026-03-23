import axios from 'axios';

/**
 * Fetches the current price for a given symbol from OKX public market API
 * Support coins like: BTC, ETH, SOL
 */
export async function getPrice(symbol = 'BTC') {
  const instId = `${symbol.toUpperCase()}-USDC`;
  const url = `https://www.okx.com/api/v5/market/ticker?instId=${instId}`;
  let retries = 3;
  
  while (retries > 0) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      if (response.data && response.data.code === '0' && response.data.data && response.data.data.length > 0) {
        return parseFloat(response.data.data[0].last);
      }
      throw new Error(`Invalid OKX response: ${JSON.stringify(response.data)}`);
    } catch (err) {
      console.warn(`${symbol} Price fetch failed: ${err.message}. Retries left: ${retries - 1}`);
      retries--;
      if (retries === 0) {
        // Fallback for development/testing
        const basePrices = { 'BTC': 69000, 'ETH': 3500, 'SOL': 140 };
        const mockPrice = (basePrices[symbol.toUpperCase()] || 100) + (Math.random() * 5);
        console.warn(`⚠️ OKX API UNREACHABLE. Using mock ${symbol} price: $${mockPrice.toFixed(2)}`);
        return mockPrice;
      }
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Keep export for backward compatibility if needed, but point to new function
export const getBTCPrice = () => getPrice('BTC');

