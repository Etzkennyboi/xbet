import { createMarket, resolveMarket } from './backend/agent.js';
import { loadMarket, saveMarket, saveBet } from './backend/db.js';

async function run() {
  try {
    console.log("Checking for active market...");
    let m = loadMarket();
    if (!m) {
        console.log("No market found, creating new one...");
        m = await createMarket();
    }
    
    if (!m) {
       console.log("Failed to create or load market.");
       process.exit(1);
    }
    
    // Use the wallet that was previously seen in history (user's test wallet)
    const userWallet = "0x5c67869272f3d167c761dbbf0dc3901a1ff214d3";

    console.log(`Injecting Mock Winning Bet for ${userWallet}...`);
    saveBet({
      id: "bet_manual_final_" + Date.now(),
      wallet: userWallet,
      marketId: m.id,
      position: "YES",
      stake: 0.05,
      txHash: "manual_stake_verify_001",
      timestamp: Date.now()
    });

    console.log("Forcing Expiration and Win Condition (Target $1.00)...");
    m.expiresAt = Date.now() - 1000;
    m.targetPrice = 1.00;
    saveMarket(m);

    console.log(">>> TRIGGERING REAL PAYOUT VIA OKX GATEWAY <<<");
    const result = await resolveMarket();

    if (result && result.payouts && result.payouts.length > 0) {
      console.log("\n=== SETTLEMENT COMPLETE ===");
      result.payouts.forEach(p => {
        console.log(`Winner: ${p.wallet}`);
        console.log(`Amount: ${p.payout} USDC`);
        console.log(`Status:  ${p.status}`);
        console.log(`TX Hash: ${p.txHash}`);
      });
    } else {
      console.log("\nMarket resolved, but no payouts were processed. Check console for 401 or other errors.");
    }
  } catch (err) {
    console.error("Critical Script Failure:", err);
  } finally {
    process.exit();
  }
}

run();
