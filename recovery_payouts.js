import { readFileSync, writeFileSync } from 'fs';
import { payWinner } from './backend/gateway.js';

async function run() {
  const historyPath = './data/history.json';
  let history = [];
  
  try {
    history = JSON.parse(readFileSync(historyPath, 'utf8'));
  } catch (e) {
    console.error("Could not read history.json");
    process.exit(1);
  }

  console.log("--- STARTING RECOVERY PAYOUTS ---");
  let totalPaid = 0;

  for (let market of history) {
    if (!market.payouts) continue;
    
    for (let payout of market.payouts) {
      if (payout.txHash === null || payout.txHash === 'FAILED_ONCHAIN' || payout.status === 'FAILED') {
        console.log(`\n💸 Found missed payout: ${payout.payout} USDC to ${payout.wallet} (Market: ${market.id})`);
        
        try {
          const txHash = await payWinner(payout.wallet, payout.payout);
          
          if (txHash && !txHash.startsWith('mock_tx')) {
            console.log(`✅ Success! Real TX Hash: ${txHash}`);
            payout.txHash = txHash;
            payout.status = 'PAID';
            totalPaid++;
          } else {
            console.warn(`⚠️ Still failing for ${payout.wallet}. Check OKX API keys or permissions.`);
          }
        } catch (err) {
          console.error(`❌ Error paying ${payout.wallet}: ${err.message}`);
        }
      }
    }
  }

  if (totalPaid > 0) {
    writeFileSync(historyPath, JSON.stringify(history, null, 2));
    console.log(`\n🎉 Successfully recovered ${totalPaid} payouts! history.json updated.`);
  } else {
    console.log("\nNo payouts were successfully recovered. Check connectivity and credentials.");
  }

  process.exit();
}

run();
