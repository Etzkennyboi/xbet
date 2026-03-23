import { getBTCPrice } from './backend/market-api.js';

async function test() {
  console.log("--- BTC Price Feed Diagnostic ---");
  const price = await getBTCPrice();
  console.log(`Fetched Price: $${price.toLocaleString()}`);
  
  if (price >= 69000 && price <= 69100) {
      console.warn("⚠️ WARNING: This price looks suspicious (matches the static MOCK range).");
      console.warn("Check if the OKX API is blocked by your current VPN/Proxy.");
  } else {
      console.log("✅ Price seems to be coming from the real API.");
  }
  process.exit();
}

test();
