import axios from 'axios';
import crypto from 'crypto';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Executes a contract call using the OKX Onchain OS API for Agentic Wallets.
 * This allows the agent to sign transactions WITHOUT a private key,
 * using the OKX platform's secure enclave (TEE).
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
    console.error(`[GATEWAY ERROR] Missing OKX API credentials or Agent address.`);
    return null;
  }

  try {
    // 1. Prepare Call Data
    const usdcAbi = ["function transfer(address to, uint256 amount) returns (bool)"];
    const iface = new ethers.utils.Interface(usdcAbi);
    const parsedAmount = ethers.utils.parseUnits(Number(amount).toFixed(decimals), decimals);
    const data = iface.encodeFunctionData("transfer", [toAddress, parsedAmount]);

    // 2. Setup OKX API Request
    const timestamp = new Date().toISOString();
    const method = 'POST';
    const requestPath = '/api/v5/wallet/onchain/execute';
    
    const body = {
      from: agentWallet,
      to: usdcAddress,
      inputData: data,
      chainIndex: chainId.toString()
    };
    
    const bodyString = JSON.stringify(body);
    
    // 3. Generate OKX Signature
    const message = timestamp + method + requestPath + bodyString;
    const signature = crypto.createHmac('sha256', secretKey)
                            .update(message)
                            .digest('base64');

    console.log(`[GATEWAY] Requesting OKX Agentic Wallet payout: ${amount} USDC to ${toAddress.slice(0,10)}...`);

    const response = await axios({
      method,
      url: `https://www.okx.com${requestPath}`,
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': passphrase,
      },
      data: body
    });

    const result = response.data;

    if (result && result.code === '0' && result.data && result.data[0] && result.data[0].txHash) {
      const txHash = result.data[0].txHash;
      console.log(`[GATEWAY] SUCCESS: ${txHash}`);
      return txHash;
    } else {
      console.error(`[GATEWAY ERROR] OKX API returned an error:`, result.msg || 'Unknown error');
      if (result.data && result.data[0] && result.data[0].errorMsg) {
         console.error(`[GATEWAY DETAIL] ${result.data[0].errorMsg}`);
      }
      return null;
    }

  } catch (err) {
    const errorMsg = err.response?.data?.msg || err.message;
    console.error(`[GATEWAY ERROR DETAILS] ${errorMsg}`);
    return null;
  }
}
