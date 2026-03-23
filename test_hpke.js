import axios from 'axios';
import crypto from 'crypto';
import { CipherSuite, DhkemX25519HkdfSha256, HkdfSha256, Aes256Gcm } from '@hpke/core';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const suite = new CipherSuite({
        kem: new DhkemX25519HkdfSha256(),
        kdf: new HkdfSha256(),
        aead: new Aes256Gcm(),
    });

    // Generate kem keypair
    const rkp = await suite.kem.generateKeyPair();
    // Export private and public as Uint8Arrays
    const privRaw = await crypto.subtle.exportKey('pkcs8', rkp.privateKey);
    const pubRaw = await crypto.subtle.exportKey('spki', rkp.publicKey);
    
    // We only need the raw 32-byte curve points
    const privateKeyBuf = new Uint8Array(privRaw).slice(-32);
    const publicKeyBuf = new Uint8Array(pubRaw).slice(-32);

    const tempPubKey = Buffer.from(publicKeyBuf).toString('base64');
    
    // Init AK
    const initResp = await axios.post('https://web3.okx.com/priapi/v5/wallet/agentic/auth/ak/init', 
      { apiKey: process.env.OKX_API_KEY },
      { headers: { 'ok-client-version': '2.1.0', 'Ok-Access-Client-type': 'agent-cli' } }
    );
    const { nonce, iss } = initResp.data.data[0];

    const timestamp = Date.now().toString();
    const signMessage = timestamp + 'GET' + '/web3/ak/agentic/login' + `?locale=en-US&nonce=${nonce}&iss=${iss}`;
    const sign = crypto.createHmac('sha256', process.env.OKX_SECRET_KEY).update(signMessage).digest('base64');

    const verifyResp = await axios.post('https://web3.okx.com/priapi/v5/wallet/agentic/auth/ak/verify',
      {
        tempPubKey,
        apiKey: process.env.OKX_API_KEY,
        passphrase: process.env.OKX_PASSPHRASE,
        timestamp,
        sign,
        locale: 'en-US'
      },
      { headers: { 'ok-client-version': '2.1.0', 'Ok-Access-Client-type': 'agent-cli' } }
    );

    const { encryptedSessionSk } = verifyResp.data.data[0];
    const encryptedBytes = Buffer.from(encryptedSessionSk, 'base64');
    
    const enc = encryptedBytes.slice(0, 32);
    const ct = encryptedBytes.slice(32);
    const info = new TextEncoder().encode("okx-tee-sign");

    const recipient = await suite.createRecipientContext({
        recipientKey: rkp.privateKey,
        enc,
        info
    });

    const decryptedSeed = await recipient.open(ct);
    console.log("SUCCESS! Decrypted seed length:", decryptedSeed.byteLength);

    // NaCl Signing logic test
    // Tweetnacl doesn't come with package json exports sometimes, but try import
    const nacl = (await import('tweetnacl')).default || (await import('tweetnacl'));
    const { ethers } = await import('ethers');

    const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(decryptedSeed));
    
    // Simulate signing the hash from out5.txt
    const hash = "0xde955cf118905b3b11b753642d6f1a164dbba8f0235b455522de46135b29e236";
    const data = Buffer.from(hash.replace('0x', ''), 'hex');
    const keccakHash = ethers.utils.hashMessage(new Uint8Array(data));
    const keccakBuffer = Buffer.from(keccakHash.replace('0x', ''), 'hex');

    const signatureBytes = nacl.sign.detached(new Uint8Array(keccakBuffer), keyPair.secretKey);
    const signatureBase64 = Buffer.from(signatureBytes).toString('base64');
    
    console.log("EIP191 Sig (Base64):", signatureBase64);
}

run().catch(console.error);
