const { ethers } = require("hardhat");
const marketplaceConfig = require('../frontend/src/marketplaceConfig.json');

async function main() {
  console.log("\n🔧 Updating Marketplace Fee Recipient...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Admin:", deployer.address);

  // Get marketplace contract
  const marketplace = await ethers.getContractAt(
    "Marketplace",
    marketplaceConfig.marketplace
  );

  // Update fee recipient to deployer (can receive ETH)
  console.log("Current fee recipient:", await marketplace.feeRecipient());
  
  const tx = await marketplace.updateFeeRecipient(deployer.address);
  await tx.wait();
  
  console.log("✅ Updated fee recipient to:", deployer.address);
  console.log("\n💡 Now the marketplace can accept ETH fees!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
