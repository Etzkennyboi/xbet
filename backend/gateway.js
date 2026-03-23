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
    : './bin/onchainos'; // Standard Linux relative execution

  const fs = await import('fs');
  if (!fs.existsSync(binPath)) {
    console.error(`[GATEWAY ERROR] OKX CLI binary not found at: ${binPath}`);
    console.error(`[GATEWAY INFO] Running 'ls -R ./bin' for debug:`);
    try {
        const { stdout: lsOut } = await execAsync('ls -R ./bin || echo "ls failed"');
        console.log(lsOut);
    } catch(e) {}
    return null;
  }

  try {
    // 1. Prepare ABI Data
    const usdcAbi = ["function transfer(address to, uint256 amount) returns (bool)"];
    const iface = new ethers.utils.Interface(usdcAbi);
    const parsedAmount = ethers.utils.parseUnits(Number(amount).toFixed(decimals), decimals);
    const data = iface.encodeFunctionData("transfer", [toAddress, parsedAmount]);

    // 2. Invoke Onchain OS CLI
    // Note: On Linux, we use the absolute path from process.cwd() or relative ./bin/onchainos
    const fullBinPath = isWindows ? binPath : path.resolve(process.cwd(), binPath);
    const cmd = `"${fullBinPath}" wallet contract-call --to "${usdcAddress}" --chain ${chainId} --input-data "${data}" --from "${agentWallet}" --force`;
    
    console.log(`[GATEWAY] Executing payout: ${amount} USDC to ${toAddress.slice(0,10)}...`);
    
    let stdout;
    try {
        const res = await execAsync(cmd);
        stdout = res.stdout;
    } catch (cmdErr) {
        stdout = cmdErr.stdout || "";
        console.error(`[GATEWAY ERROR] CLI execution failed. Exit Code: ${cmdErr.code}`);
        if (cmdErr.stderr) console.error(`[GATEWAY STDERR] ${cmdErr.stderr}`);
        
        // Final fallback: Maybe the error is "Not Found" because of a missing shared library on Musl vs Gnu
        if (cmdErr.message.toLowerCase().includes("not found")) {
            console.error(`[GATEWAY INFO] "Not Found" usually means the binary exists but lacks libraries. Switching to npx fallback?`);
        }
    }
    
    if (!stdout.trim()) {
       console.error(`[GATEWAY ERROR] CLI returned empty output. Check Railway Environment Variables.`);
       return null;
    }

    // Parse the JSON CLI output
    let result;
    try {
        result = JSON.parse(stdout);
    } catch (parseErr) {
        console.error(`[GATEWAY ERROR] Failed to parse CLI output: ${stdout}`);
        return null;
    }

    if (result && result.ok && result.data && result.data.txHash) {
        console.log(`[GATEWAY] SUCCESS: ${result.data.txHash}`);
        return result.data.txHash;
    } else {
        const errDetail = result?.data?.executeErrorMsg || result?.error || 'Unknown Error';
        console.error(`[GATEWAY ERROR] Payout Failed: ${errDetail}`);
        return null;
    }

  } catch (err) {
    console.error(`[GATEWAY ERROR DETAILS] ${err.message}`);
    return null;
  }
}
