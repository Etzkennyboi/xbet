import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const rpc = process.env.RPC_URL || "https://rpc.xlayer.tech";
  const address = process.env.AGENT_WALLET_ADDRESS;
  const usdcAddress = process.env.USDC_ADDRESS;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const okbBal = await provider.getBalance(address);
  console.log(`OKB:${ethers.utils.formatEther(okbBal)}`);

  if (usdcAddress) {
      const usdcAbi = ["function balanceOf(address owner) view returns (uint256)"];
      const contract = new ethers.Contract(usdcAddress, usdcAbi, provider);
      const usdcBal = await contract.balanceOf(address);
      console.log(`USDC:${ethers.utils.formatUnits(usdcBal, 6)}`);
  }
  process.exit();
}
check();
