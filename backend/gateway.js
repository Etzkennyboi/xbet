import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const execAsync = util.promisify(exec);

/**
 * Payout logic using the OKX OnchainOS CLI.
 * Uses OKXWEB3_HOME to bypass Keyring service failures on cloud environments like Railway.
 */
export async function payWinner(toAddress, amount) {
  const isWindows = process.platform === 'win32';
  const binPath = isWindows 
    ? path.join(process.env.USERPROFILE, '.local', 'bin', 'onchainos.exe')
    : path.resolve(process.cwd(), 'bin', 'onchainos');

  if (!fs.existsSync(binPath)) {
    console.error(`[GATEWAY ERROR] OKX CLI binary not found at: ${binPath}`);
    return null;
  }

  // CRITICAL FIX: Set OKXWEB3_HOME to a local project directory.
  // This forces the CLI to use a local JSON file for credentials instead of a system keyring.
  const dataDir = path.join(process.cwd(), 'data', 'okx');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  const env = { 
    ...process.env, 
    OKXWEB3_HOME: dataDir,
    // Add PATH for Linux if it's missing (helps CLI find itself)
    PATH: process.env.PATH + (isWindows ? '' : ':/usr/local/bin:/usr/bin:/bin')
  };

  const agentWallet = process.env.AGENT_WALLET_ADDRESS;
  const usdcAddress = process.env.USDC_ADDRESS;
  const chainId = process.env.CHAIN_ID || '196';
  const decimals = parseInt(process.env.USDC_DECIMALS) || 6;

  try {
    // 1. Silent Login (Ensure we are authorized with the API Keys)
    console.log(`[GATEWAY] Authorizing with OKX API...`);
    await execAsync(`"${binPath}" wallet login --force`, { env });

    // 2. Prepare Transaction
    const usdcAbi = ["function transfer(address to, uint256 amount) returns (bool)"];
    const iface = new ethers.utils.Interface(usdcAbi);
    const parsedAmount = ethers.utils.parseUnits(Number(amount).toFixed(decimals), decimals);
    const data = iface.encodeFunctionData("transfer", [toAddress, parsedAmount]);

    // 3. Execute Contract Call
    const cmd = `"${binPath}" wallet contract-call --to "${usdcAddress}" --chain "${chainId}" --input-data "${data}" --from "${agentWallet}" --force`;
    
    console.log(`[GATEWAY] Executing payout: ${amount} USDC to ${toAddress.slice(0,10)}...`);
    
    const { stdout, stderr } = await execAsync(cmd, { env });
    
    if (stderr && !stdout) {
      console.error(`[GATEWAY STDERR] ${stderr}`);
    }

    // Parse the JSON CLI output
    let result;
    try {
        result = JSON.parse(stdout);
    } catch (parseErr) {
        console.error(`[GATEWAY ERROR] Failed to parse CLI output. Raw: ${stdout}`);
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
    const errorMsg = err.stdout ? (JSON.parse(err.stdout).data?.executeErrorMsg || err.stdout) : err.message;
    console.error(`[GATEWAY ERROR DETAILS] ${errorMsg}`);
    return null;
  }
}

