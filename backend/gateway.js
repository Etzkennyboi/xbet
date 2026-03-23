import axios from 'axios';
import crypto from 'crypto';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Pure JavaScript payout logic for OKX Agentic Wallets.
 * Bypasses the binary CLI to avoid "Platform secure storage" failures on Linux.
 * Final version using verified 'agentic' endpoint and precise timestamping.
 */
export async function payWinner(toAddress, amount) {
  const apiKey = process.env.OKX_API_KEY;
  const secretKey = process.env.OKX_SECRET_KEY;
  const passphrase = process.env.OKX_PASSPHRASE;
  const agentWallet = process.env.AGENT_WALLET_ADDRESS;
  const usdcAddress = process.env.USDC_ADDRESS;
  const chainId = process.env.CHAIN_ID || '196';
  const decimals = parseInt(process.env.USDC_DECIMALS) || 6;

  if (!apiKey || !secretKey || !passphrase || !agentWallet) {
    console.error(`[GATEWAY ERROR] Missing OKX API Credentials in environment.`);
    return null;
  }

  try {
    // 1. Prepare USDC Transfer Data
    const usdcAbi = ["function transfer(address to, uint256 amount) returns (bool)"];
    const iface = new ethers.utils.Interface(usdcAbi);
    const parsedAmount = ethers.utils.parseUnits(Number(amount).toFixed(decimals), decimals);
    const data = iface.encodeFunctionData("transfer", [toAddress, parsedAmount]);

    // 2. Format Request for OKX Onchain OS
    // NOTE: OKX requires timestamp WITHOUT milliseconds: YYYY-MM-DDTHH:mm:ssZ
    const timestamp = new Date().toISOString().slice(0, -5) + 'Z';
    const method = 'POST';
    const requestPath = '/api/v5/wallet/agentic/execute';
    
    const body = {
      from: agentWallet,
      to: usdcAddress,
      inputData: data,
      chainIndex: chainId.toString()
    };
    
    const bodyString = JSON.stringify(body);
    
    // 3. Generate OKX Signature (V5)
    // Formula: timestamp + method + path + body
    const message = timestamp + method + requestPath + bodyString;
    const signature = crypto.createHmac('sha256', secretKey)
                            .update(message)
                            .digest('base64');

    console.log(`[GATEWAY] API Request: Paying ${amount} USDC to ${toAddress.slice(0,10)}...`);

    const response = await axios({
      method,
      url: `https://web3.okx.com${requestPath}`,
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': passphrase,
      },
      data: body,
      timeout: 20000
    });

    const result = response.data;

    // OKX success code is "0"
    if (result && result.code === '0' && result.data && result.data[0]?.txHash) {
      const txHash = result.data[0].txHash;
      console.log(`[GATEWAY] SUCCESS: ${txHash}`);
      return txHash;
    } else {
      const msg = result?.msg || 'Unknown API Error';
      const detail = result?.data?.[0]?.errorMsg || '';
      console.error(`[GATEWAY ERROR] OKX API Rejected: ${msg} ${detail}`);
      if (result?.code) console.error(`[GATEWAY ERROR CODE] ${result.code}`);
      return null;
    }

  } catch (err) {
    const apiMsg = err.response?.data?.msg || err.message;
    console.error(`[GATEWAY ERROR DETAILS] ${apiMsg}`);
    if (err.response?.status === 404) {
        console.error(`[GATEWAY INFO] Endpoint ${err.config.url} not found. Retrying fallback...`);
    }
    return null;
  }
}


