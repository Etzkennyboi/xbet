import hre from "hardhat";

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("   CRYPTOCALL — DEPLOY ONCHAIN LEDGER");
  console.log("═══════════════════════════════════════════════\n");

  const network = hre.network.name;
  const chainId = hre.network.config.chainId;
  console.log(`📡 Network: ${network} (Chain ID: ${chainId})`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deployer (Agent): ${deployer.address}`);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`💎 Balance: ${hre.ethers.formatEther(balance)} OKB\n`);

  console.log("═══════════════════════════════════════════════");
  console.log("   DEPLOYING CONTRACT...");
  console.log("═══════════════════════════════════════════════\n");

  const Contract = await hre.ethers.getContractFactory("CryptoCall");
  const contract = await Contract.deploy();

  console.log("⏳ Waiting for deployment transaction...");
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`✅ Contract deployed successfully!`);
  console.log(`📍 Contract Address: ${contractAddress}\n`);

  // Verify deployment
  const operator = await contract.operator();
  console.log(`✅ Operator set to:  ${operator}\n`);

  // Save deployment info
  const fs = await import("fs");
  const deploymentInfo = {
    network,
    chainId,
    contractAddress,
    operator: operator,
    timestamp: new Date().toISOString(),
    transactionHash: contract.deploymentTransaction()?.hash
  };

  fs.writeFileSync(
    "./deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("📄 Deployment info saved to: deployment-info.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed!");
    console.error(error);
    process.exit(1);
  });
