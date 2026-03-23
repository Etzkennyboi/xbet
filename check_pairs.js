import axios from 'axios';

async function check() {
  const usdtUrl = 'https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT';
  const usdcUrl = 'https://www.okx.com/api/v5/market/ticker?instId=BTC-USDC';

  try {
    const [usdt, usdc] = await Promise.all([
      axios.get(usdtUrl),
      axios.get(usdcUrl)
    ]);
    
    console.log(`BTC-USDT: $${usdt.data.data[0].last}`);
    console.log(`BTC-USDC: $${usdc.data.data[0].last}`);
    const diff = Math.abs(parseFloat(usdt.data.data[0].last) - parseFloat(usdc.data.data[0].last));
    console.log(`Difference: $${diff.toFixed(2)}`);

  } catch (err) {
    console.error("Failed:", err.message);
  }
}

check();
