import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

async function withdraw() {
  const rpc = process.env.RPC_URL || "https://rpc.xlayer.tech";
  const pKey = process.env.AGENT_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const treasury = "0x5C67869272f3d167c761dBbf0DC3901a1fF214D3";
  const usdcAddress = process.env.USDC_ADDRESS;

  if (!pKey) {
    console.error("No private key found in .env");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pKey.trim(), provider);
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`--- Withdraw All to ${treasury} ---`);
  console.log(`Wallet: ${wallet.address}`);
  if (isDryRun) console.log("!! DRY RUN MODE - No transactions will be sent !!");

  try {
    // 1. USDC Transfer
    if (usdcAddress) {
      const usdcAbi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function transfer(address to, uint256 amount) returns (bool)"
      ];
      const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, wallet);
      const usdcBal = await usdcContract.balanceOf(wallet.address);

      if (usdcBal.gt(0)) {
        console.log(`USDC Balance: ${ethers.utils.formatUnits(usdcBal, 6)} USDC`);
        if (!isDryRun) {
          console.log("Sending USDC...");
          const tx = await usdcContract.transfer(treasury, usdcBal);
          console.log(`USDC TX Hash: ${tx.hash}`);
          await tx.wait();
          console.log("USDC Transfer Confirmed");
        } else {
          console.log(`[DRY-RUN] Would send ${ethers.utils.formatUnits(usdcBal, 6)} USDC`);
        }
      } else {
        console.log("No USDC to transfer.");
      }
    }

    // 2. Native OKB Transfer (send all except gas)
    const okbBal = await provider.getBalance(wallet.address);
    if (okbBal.gt(0)) {
      console.log(`OKB Balance: ${ethers.utils.formatEther(okbBal)} OKB`);
      
      const gasPrice = await provider.getGasPrice();
      const gasLimit = 21000;
      const gasCost = gasPrice.mul(gasLimit);
      
      if (okbBal.gt(gasCost)) {
        const amountToSend = okbBal.sub(gasCost);
        console.log(`Amount after gas: ${ethers.utils.formatEther(amountToSend)} OKB`);
        
        if (!isDryRun) {
          console.log("Sending OKB...");
          const tx = await wallet.sendTransaction({
            to: treasury,
            value: amountToSend,
            gasPrice: gasPrice,
            gasLimit: gasLimit
          });
          console.log(`OKB TX Hash: ${tx.hash}`);
          await tx.wait();
          console.log("OKB Transfer Confirmed");
        } else {
          console.log(`[DRY-RUN] Would send ${ethers.utils.formatEther(amountToSend)} OKB`);
        }
      } else {
        console.log("Not enough OKB to cover gas for a transfer.");
      }
    } else {
      console.log("No OKB to transfer.");
    }

  } catch (err) {
    console.error("Error during withdrawal:", err.message);
  }

  process.exit();
}

withdraw();
