import axios from 'axios';
import crypto from 'crypto';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Session Cache (to avoid logging in on every payout)
const SESSION_CACHE_PATH = path.join(process.cwd(), 'data', 'okx_session.json');

/**
 * Full OKX Agentic Wallet Authenticated Payout.
 * Performs the handshake: AK -> JWT then JWT -> Execution.
 */
export async function payWinner(toAddress, amount) {
  const credentials = {
    apiKey: process.env.OKX_API_KEY,
    secretKey: process.env.OKX_SECRET_KEY,
    passphrase: process.env.OKX_PASSPHRASE,
    agentWallet: process.env.AGENT_WALLET_ADDRESS,
    usdcAddress: process.env.USDC_ADDRESS,
    chainId: process.env.CHAIN_ID || '196',
    decimals: parseInt(process.env.USDC_DECIMALS) || 6
  };

  if (!credentials.apiKey || !credentials.secretKey || !credentials.passphrase) {
    console.error(`[GATEWAY ERROR] Missing OKX API Credentials.`);
    return null;
  }

  try {
    // 1. Get a valid Session
    let session = await getOrRefreshSession(credentials);
    if (!session) return null;

    // 2. Prepare USDC Transfer Data
    const usdcAbi = ["function transfer(address to, uint256 amount) returns (bool)"];
    const iface = new ethers.utils.Interface(usdcAbi);
    const parsedAmount = ethers.utils.parseUnits(Number(amount).toFixed(credentials.decimals), credentials.decimals);
    const data = iface.encodeFunctionData("transfer", [toAddress, parsedAmount]);

    // 3. Execute Contract Call (Discovery: /priapi/v5/wallet/agentic/pre-transaction/unsignedInfo)
    const requestPath = '/priapi/v5/wallet/agentic/pre-transaction/unsignedInfo';
    const body = {
      fromAddr: credentials.agentWallet,
      toAddr: credentials.usdcAddress,
      inputData: data,
      chainIndex: parseInt(credentials.chainId),
      value: "0",
      sessionCert: session.sessionCert,
      chainPath: "m/44'/60'/0'/0/0" // Default for Ethereum/XLayer
    };

    console.log(`[GATEWAY] Executing Auth-Payout: ${amount} USDC to ${toAddress.slice(0,10)}...`);

    const response = await axios({
      method: 'POST',
      url: `https://web3.okx.com${requestPath}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
        'ok-client-version': '2.1.0',
        'Ok-Access-Client-type': 'agent-cli'
      },
      data: body
    });

    const result = response.data;

    if (result && result.code === '0' && result.data && result.data[0]) {
      const tx = result.data[0];
      const txHash = tx.txHash || tx.unsignedTxHash;
      if (txHash) {
        console.log(`[GATEWAY] SUCCESS: ${txHash}`);
        return txHash;
      }
    }

    console.error(`[GATEWAY ERROR] Payout Failed: ${result?.msg || 'Unknown Error'}`);
    return null;

  } catch (err) {
    console.error(`[GATEWAY ERROR DETAILS] ${err.response?.data?.msg || err.message}`);
    // If token invalid, clear cache
    if (err.response?.data?.code === '50011') fs.rmSync(SESSION_CACHE_PATH, { force: true });
    return null;
  }
}

async function getOrRefreshSession(creds) {
  // Load from cache
  try {
    if (fs.existsSync(SESSION_CACHE_PATH)) {
      const cache = JSON.parse(fs.readFileSync(SESSION_CACHE_PATH, 'utf8'));
      if (cache.expiresAt > Date.now()) return cache;
    }
  } catch (e) {}

  console.log(`[GATEWAY] Handshaking with OKX (AK -> JWT)...`);

  try {
    // A. Init (Discovery: /priapi/v5/wallet/agentic/auth/ak/init)
    const initResp = await axios.post('https://web3.okx.com/priapi/v5/wallet/agentic/auth/ak/init', 
      { apiKey: creds.apiKey },
      { headers: { 'ok-client-version': '2.1.0', 'Ok-Access-Client-type': 'agent-cli' } }
    );
    const { nonce, iss } = initResp.data.data[0];

    // B. Generate X25519 Session Key
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
    // Extract raw 32-byte public key (skip DER headers)
    const pubBuf = publicKey.export({ format: 'der', type: 'spki' }).slice(-32);
    const tempPubKey = pubBuf.toString('base64');

    // C. Verify (Discovery: /priapi/v5/wallet/agentic/auth/ak/verify)
    const timestamp = Date.now().toString();
    const signPath = '/web3/ak/agentic/login';
    const signParams = `?locale=en-US&nonce=${nonce}&iss=${iss}`;
    const signMessage = timestamp + 'GET' + signPath + signParams;
    const sign = crypto.createHmac('sha256', creds.secretKey).update(signMessage).digest('base64');

    const verifyBody = {
      tempPubKey,
      apiKey: creds.apiKey,
      passphrase: creds.passphrase,
      timestamp,
      sign,
      locale: 'en-US'
    };

    const verifyResp = await axios.post('https://web3.okx.com/priapi/v5/wallet/agentic/auth/ak/verify',
      verifyBody,
      { headers: { 'ok-client-version': '2.1.0', 'Ok-Access-Client-type': 'agent-cli' } }
    );

    const authData = verifyResp.data.data[0];
    const session = {
      accessToken: authData.accessToken,
      sessionCert: authData.sessionCert,
      expiresAt: Date.now() + 3600000 // 1 hour cache
    };

    // Save to cache
    const dataDir = path.dirname(SESSION_CACHE_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(SESSION_CACHE_PATH, JSON.stringify(session));

    return session;
  } catch (err) {
    console.error(`[GATEWAY AUTH ERROR] ${err.response?.data?.msg || err.message}`);
    return null;
  }
}



