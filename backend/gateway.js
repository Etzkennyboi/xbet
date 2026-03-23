import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const execAsync = util.promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Executes a contract call using the official OKX OnchainOS CLI.
 * This handles simulation, gas estimation, and the secure TEE signing.
 */
export async function payWinner(toAddress, amount) {
  const agentWallet = process.env.AGENT_WALLET_ADDRESS;
  const usdcAddress = process.env.USDC_ADDRESS;
  const chainId = process.env.CHAIN_ID || 196;
  const decimals = parseInt(process.env.USDC_DECIMALS) || 6;

  if (!agentWallet || !usdcAddress) {
    console.error(`[GATEWAY ERROR] Missing AGENT_WALLET_ADDRESS or USDC_ADDRESS.`);
    return null;
  }

  // Detect correct CLI path (Linux/Railway uses internal bin, Windows uses local home)
  const isWindows = process.platform === 'win32';
  const binPath = isWindows 
    ? path.join(process.env.USERPROFILE, '.local', 'bin', 'onchainos.exe')
    : path.resolve(process.cwd(), 'bin', 'onchainos');

  try {
    // 1. Prepare ABI Data
    const usdcAbi = ["function transfer(address to, uint256 amount) returns (bool)"];
    const iface = new ethers.utils.Interface(usdcAbi);
    const parsedAmount = ethers.utils.parseUnits(Number(amount).toFixed(decimals), decimals);
    const data = iface.encodeFunctionData("transfer", [toAddress, parsedAmount]);

    // 2. Invoke Onchain OS CLI
    const cmd = `"${binPath}" wallet contract-call --to "${usdcAddress}" --chain ${chainId} --input-data "${data}" --from "${agentWallet}" --force`;
    
    console.log(`[GATEWAY] Executing CLI payout: ${amount} USDC to ${toAddress.slice(0,10)}...`);
    
    let stdout, stderr;
    try {
        const res = await execAsync(cmd);
        stdout = res.stdout;
    } catch (cmdErr) {
        // Capture output even if it failed, as it might contain the JSON error body
        stdout = cmdErr.stdout || "{}";
    }
    
    // Parse the JSON CLI output
    const result = JSON.parse(stdout);
    if (result && result.ok && result.data && result.data.txHash) {
        console.log(`[GATEWAY] SUCCESS: ${result.data.txHash}`);
        return result.data.txHash;
    } else {
        const errDetail = result?.data?.executeErrorMsg || result?.error || 'Unknown CLI Error';
        console.error(`[GATEWAY ERROR] CLI Failed: ${errDetail}`);
        return null;
    }

  } catch (err) {
    console.error(`[GATEWAY ERROR DETAILS] ${err.message}`);
    return null;
  }
}
