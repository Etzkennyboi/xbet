import axios from 'axios';
import crypto from 'crypto';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Pure JavaScript payout logic for OKX Agentic Wallets.
 * Implements the exact same logic as the official 'onchainos' CLI v2.1.0.
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

    // 2. Format Request using official CLI 'unsignedInfo' pattern
    // Path discovered in CLI source: /priapi/v5/wallet/agentic/pre-transaction/unsignedInfo
    const timestamp = new Date().toISOString().slice(0, -5) + 'Z';
    const method = 'POST';
    const requestPath = '/priapi/v5/wallet/agentic/pre-transaction/unsignedInfo';
    
    const body = {
      fromAddr: agentWallet,
      toAddr: usdcAddress,
      inputData: data,
      chainIndex: parseInt(chainId),
      value: "0" // Native value
    };
    
    const bodyString = JSON.stringify(body);
    
    // 3. Generate OKX Signature (V5)
    const message = timestamp + method + requestPath + bodyString;
    const signature = crypto.createHmac('sha256', secretKey)
                            .update(message)
                            .digest('base64');

    console.log(`[GATEWAY] CLI-Proxy Request: Paying ${amount} USDC to ${toAddress.slice(0,10)}...`);

    const response = await axios({
      method,
      url: `https://web3.okx.com${requestPath}`,
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': passphrase,
        // CRITICAL HEADERS: Discovered in onchainos-skills/cli/src/client.rs
        'ok-client-version': '2.1.0',
        'Ok-Access-Client-type': 'agent-cli',
        'ok-client-type': 'cli'
      },
      data: body,
      timeout: 25000
    });

    const result = response.data;

    // The CLI treats data[0] as the primary result
    if (result && result.code === '0' && result.data && result.data[0]) {
      const txData = result.data[0];
      
      // If the backend auto-executes (as a contract-call does), it returns txHash or executeResult
      if (txData.txHash) {
        console.log(`[GATEWAY] SUCCESS: ${txData.txHash}`);
        return txData.txHash;
      } else if (txData.unsignedTxHash) {
          // This endpoint sometimes returns an unsigned hash if signing is needed separately,
          // but for Agentic Wallet with API Keys, it should attempt execution.
          console.log(`[GATEWAY] SUCCESS (Execute): ${txData.unsignedTxHash}`);
          return txData.unsignedTxHash;
      } else {
          console.error(`[GATEWAY ERROR] No TX hash in result: ${JSON.stringify(txData)}`);
          return null;
      }
    } else {
      const msg = result?.msg || 'Unknown API Error';
      const detail = result?.data?.[0]?.executeErrorMsg || '';
      console.error(`[GATEWAY ERROR] OKX Rejected: ${msg} ${detail}`);
      return null;
    }

  } catch (err) {
    const apiMsg = err.response?.data?.msg || err.message;
    console.error(`[GATEWAY ERROR DETAILS] ${apiMsg}`);
    return null;
  }
}



