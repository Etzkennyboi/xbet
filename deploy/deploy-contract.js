/**
 * Deploy PredictionMarket Contract to X Layer
 * 
 * Run: npm run deploy:contract
 * 
 * Prerequisites:
 * 1. Set PRIVATE_KEY in .env
 * 2. Set TREASURY_ADDRESS in .env
 */

import { createPublicClient, createWalletClient, http, encodeDeployData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { xlayer } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration
const USDC_ADDRESS = '0x74b7F16337b8972027F6196A17a631aC6dE26d22';
const RPC_URL = 'https://rpc.xlayer.tech';

async function deploy() {
  console.log('🚀 Deploying PredictionMarket to X Layer...\n');

  // Validate environment
  const privateKey = process.env.PRIVATE_KEY;
  const treasuryAddress = process.env.TREASURY_ADDRESS;

  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env');
    console.log('Add: PRIVATE_KEY=0xyour_private_key');
    process.exit(1);
  }

  if (!treasuryAddress) {
    console.error('❌ TREASURY_ADDRESS not found in .env');
    process.exit(1);
  }

  // Create clients
  const account = privateKeyToAccount(privateKey);
  
  const publicClient = createPublicClient({
    chain: xlayer,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: xlayer,
    transport: http(RPC_URL),
  });

  console.log(`📝 Deployer: ${account.address}`);
  console.log(`🏦 Treasury: ${treasuryAddress}`);
  console.log(`💰 USDC: ${USDC_ADDRESS}\n`);

  // Contract bytecode (you would normally compile this with Hardhat/Forge)
  // For now, we'll use a placeholder - in production, compile the .sol file
  const bytecodePath = path.join(process.cwd(), 'contracts', 'PredictionMarket.bin');
  
  let bytecode;
  let abi;

  if (fs.existsSync(bytecodePath)) {
    bytecode = fs.readFileSync(bytecodePath, 'utf8');
    console.log('✅ Bytecode loaded from PredictionMarket.bin');
  } else {
    console.log('⚠️  Bytecode file not found. Using placeholder.');
    console.log('   In production: Compile contract with `npx hardhat compile`');
    bytecode = '0x'; // Placeholder - replace with actual bytecode
  }

  // Load ABI
  const abiPath = path.join(process.cwd(), 'contracts', 'PredictionMarket.abi.json');
  
  if (fs.existsSync(abiPath)) {
    const abiData = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    abi = abiData.abi;
    console.log('✅ ABI loaded');
  } else {
    console.log('⚠️  ABI file not found. Using config ABI.');
    // Import from config
    const configPath = path.join(process.cwd(), '..', 'config.js');
    if (fs.existsSync(configPath)) {
      const { MARKET_ABI } = await import(configPath);
      abi = MARKET_ABI;
    }
  }

  // Encode constructor arguments
  // constructor(address _usdc, address _treasury)
  const constructorArgs = {
    address: USDC_ADDRESS,
    args: [USDC_ADDRESS, treasuryAddress]
  };

  console.log('📤 Submitting deployment transaction...\n');

  try {
    // In production with real bytecode:
    // const hash = await walletClient.deployContract({
    //   abi,
    //   bytecode: bytecode as `0x${string}`,
    //   args: [USDC_ADDRESS, treasuryAddress],
    // });

    // For demo without compiled bytecode:
    console.log('⚠️  Deployment requires compiled contract bytecode.');
    console.log('\n📋 MANUAL DEPLOYMENT STEPS:');
    console.log('==========================');
    console.log('1. Install Hardhat: npm install -D hardhat');
    console.log('2. Initialize: npx hardhat init');
    console.log('3. Copy PredictionMarket.sol to contracts/');
    console.log('4. Compile: npx hardhat compile');
    console.log('5. Deploy: npx hardhat run scripts/deploy.js --network xlayer');
    console.log('\n📄 Sample Hardhat Deploy Script:');
    console.log('```javascript');
    console.log('const hre = require("hardhat");');
    console.log('module.exports = async () => {');
    console.log('  const Contract = await hre.ethers.getContractFactory("PredictionMarket");');
    console.log('  const contract = await Contract.deploy("0x74b7F16337b8972027F6196A17a631aC6dE26d22", "0x5C67869272f3d167c761dBbf0DC3901a1fF214D3");');
    console.log('  await contract.deployed();');
    console.log('  console.log("Contract deployed to:", contract.address);');
    console.log('};');
    console.log('```');

    // Save deployment info
    const deploymentInfo = {
      network: 'X Layer',
      chainId: 196,
      usdc: USDC_ADDRESS,
      treasury: treasuryAddress,
      rpc: RPC_URL,
      deployer: account.address,
      timestamp: new Date().toISOString(),
      status: 'PENDING_COMPILE'
    };

    fs.writeFileSync(
      path.join(process.cwd(), 'deployment-info.json'),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log('\n📄 Deployment info saved to deployment-info.json');

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

deploy();
