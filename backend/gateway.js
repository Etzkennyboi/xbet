import axios from 'axios';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { CipherSuite, DhkemX25519HkdfSha256, HkdfSha256, Aes256Gcm } from '@hpke/core';
import nacl from 'tweetnacl';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const SESSION_CACHE_PATH = path.join(process.cwd(), 'data', 'okx_session.json');

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

  if (!credentials.apiKey) return null;

  try {
    let session = await getOrRefreshSession(credentials);
    if (!session) return null;

    const usdcAbi = ["function transfer(address to, uint256 amount) returns (bool)"];
    const iface = new ethers.utils.Interface(usdcAbi);
    const parsedAmount = ethers.utils.parseUnits(Number(amount).toFixed(credentials.decimals), credentials.decimals);
    const safeAddress = toAddress.toLowerCase();
    const data = iface.encodeFunctionData("transfer", [safeAddress, parsedAmount]);

    console.log(`[GATEWAY] Simulating TX: ${amount} USDC to ${safeAddress.slice(0,10)}...`);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.accessToken}`,
      'ok-client-version': '2.1.0',
      'Ok-Access-Client-type': 'agent-cli'
    };

    // 1. Simulate
    const unsignedResp = await axios.post('https://web3.okx.com/priapi/v5/wallet/agentic/pre-transaction/unsignedInfo', {
      fromAddr: credentials.agentWallet,
      toAddr: safeAddress,
      contractAddr: credentials.usdcAddress,
      inputData: data,
      chainIndex: parseInt(credentials.chainId),
      value: "0",
      sessionCert: session.sessionCert,
      chainPath: "m/44'/60'/0'/0/0"
    }, { headers });

    const unsignedInfo = unsignedResp.data.data[0];
    if (unsignedInfo.executeResult === false) {
      console.error(`[GATEWAY ERROR] TX Simulation failed: ${unsignedInfo.executeErrorMsg}`);
      return null;
    }

    // 2. Sign with decrypted Session Seed
    const seed = Buffer.from(session.decryptedSeed, 'base64');
    const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
    
    let msgForSign = {};
    if (unsignedInfo.hash) {
      const hashData = Buffer.from(unsignedInfo.hash.replace('0x', ''), 'hex');
      const keccakHash = ethers.utils.hashMessage(new Uint8Array(hashData));
      const keccakBuf = Buffer.from(keccakHash.replace('0x', ''), 'hex');
      const sig = nacl.sign.detached(new Uint8Array(keccakBuf), keyPair.secretKey);
      msgForSign.signature = Buffer.from(sig).toString('base64');
    }
    
    if (unsignedInfo.unsignedTxHash) {
      const txHashData = Buffer.from(unsignedInfo.unsignedTxHash.replace('0x', ''), 'hex');
      const txSig = nacl.sign.detached(new Uint8Array(txHashData), keyPair.secretKey);
      msgForSign.unsignedTxHash = unsignedInfo.unsignedTxHash;
      msgForSign.sessionSignature = Buffer.from(txSig).toString('base64');
    }
    
    if (unsignedInfo.unsignedTx) msgForSign.unsignedTx = unsignedInfo.unsignedTx;
    if (session.sessionCert) msgForSign.sessionCert = session.sessionCert;

    let extraData = unsignedInfo.extraData || {};
    extraData.checkBalance = true;
    extraData.uopHash = unsignedInfo.uopHash;
    extraData.encoding = unsignedInfo.encoding;
    extraData.signType = unsignedInfo.signType;
    extraData.msgForSign = msgForSign;

    console.log(`[GATEWAY] Attempting Broadcast...`);

    // 3. Broadcast
    const broadcastResp = await axios.post('https://web3.okx.com/priapi/v5/wallet/agentic/pre-transaction/broadcast-transaction', {
      accountId: session.accountId,
      address: credentials.agentWallet,
      chainIndex: credentials.chainId.toString(),
      extraData: JSON.stringify(extraData)
    }, { headers });

    const txResponse = broadcastResp.data.data[0];
    if (txResponse && txResponse.txHash) {
      console.log(`[GATEWAY] SUCCESS: ${txResponse.txHash}`);
      return txResponse.txHash;
    }

    console.error(`[GATEWAY ERROR] Broadcast Failed: ${JSON.stringify(broadcastResp.data)}`);
    return null;

  } catch (err) {
    console.error(`[GATEWAY ERROR DETAILS] HTTP ${err.response?.status}: ${JSON.stringify(err.response?.data) || err.message}`);
    if (err.response?.data?.code === '50011' || err.response?.status === 401) fs.rmSync(SESSION_CACHE_PATH, { force: true });
    return null;
  }
}

async function getOrRefreshSession(creds) {
  try {
    if (fs.existsSync(SESSION_CACHE_PATH)) {
      const cache = JSON.parse(fs.readFileSync(SESSION_CACHE_PATH, 'utf8'));
      if (cache.expiresAt > Date.now()) return cache;
    }
  } catch (e) {}

  console.log(`[GATEWAY] Handshaking securely with OKX TEE...`);

  try {
    const headers = { 'ok-client-version': '2.1.0', 'Ok-Access-Client-type': 'agent-cli' };
    
    // 1. Init
    const initResp = await axios.post('https://web3.okx.com/priapi/v5/wallet/agentic/auth/ak/init', { apiKey: creds.apiKey }, { headers });
    const { nonce, iss } = initResp.data.data[0];

    // 2. Generate HPKE X25519
    const suite = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
    const rkp = await suite.kem.generateKeyPair();
    const pubRaw = await crypto.subtle.exportKey('spki', rkp.publicKey);
    const tempPubKey = Buffer.from(new Uint8Array(pubRaw).slice(-32)).toString('base64');

    // 3. Verify
    const timestamp = Date.now().toString();
    const signMessage = timestamp + 'GET/web3/ak/agentic/login' + `?locale=en-US&nonce=${nonce}&iss=${iss}`;
    const sign = crypto.createHmac('sha256', creds.secretKey).update(signMessage).digest('base64');

    const verifyResp = await axios.post('https://web3.okx.com/priapi/v5/wallet/agentic/auth/ak/verify', {
      tempPubKey, apiKey: creds.apiKey, passphrase: creds.passphrase, timestamp, sign, locale: 'en-US'
    }, { headers });

    const authData = verifyResp.data.data[0];
    
    // 4. Decrypt TEE Seed HPKE
    const encryptedBytes = Buffer.from(authData.encryptedSessionSk, 'base64');
    const recipient = await suite.createRecipientContext({
        recipientKey: rkp.privateKey,
        enc: encryptedBytes.slice(0, 32),
        info: new TextEncoder().encode("okx-tee-sign")
    });
    const decryptedSeed = await recipient.open(encryptedBytes.slice(32));

    const session = {
      accessToken: authData.accessToken,
      sessionCert: authData.sessionCert,
      accountId: authData.accountId,
      decryptedSeed: Buffer.from(decryptedSeed).toString('base64'),
      expiresAt: Date.now() + 3600000 
    };

    const dataDir = path.dirname(SESSION_CACHE_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(SESSION_CACHE_PATH, JSON.stringify(session));

    return session;
  } catch (err) {
    console.error(`[GATEWAY AUTH ERROR] ${err.response?.data?.msg || err.message}`);
    return null;
  }
}




