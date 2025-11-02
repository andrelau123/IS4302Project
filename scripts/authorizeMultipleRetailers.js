/**
 * Authorize Multiple Retailers Script
 * 
 * Authorizes Hardhat accounts 17, 18, 19, 20 as retailers for the manufacturer
 * 
 * Usage:
 *   npx hardhat run scripts/authorizeMultipleRetailers.js --network localhost
 */

const hre = require("hardhat");

async function main() {
  console.log("🔐 Authorizing Multiple Retailers...\n");

  // Get all signers
  const signers = await hre.ethers.getSigners();

  // Manufacturer is typically account 1 (index 1)
  const manufacturer = signers[1];
  
  // Retailers are accounts 17, 18, 19, 20
  const retailerAccounts = [
    signers[17],
    signers[18],
    signers[19],
    signers[20]
  ];

  console.log("📋 Configuration:");
  console.log("  Manufacturer (authorizing):", manufacturer.address);
  console.log("  Retailers to authorize:");
  retailerAccounts.forEach((retailer, idx) => {
    console.log(`    Account ${17 + idx}: ${retailer.address}`);
  });
  console.log("");

  // Get deployed contract address from environment or marketplaceConfig
  let RETAILER_REGISTRY_ADDRESS = process.env.RETAILER_REGISTRY_ADDRESS;

  if (!RETAILER_REGISTRY_ADDRESS) {
    try {
      const config = require("../frontend/src/marketplaceConfig.json");
      RETAILER_REGISTRY_ADDRESS = config.RetailerRegistry;
      console.log("📝 Using RetailerRegistry from marketplaceConfig.json");
    } catch (err) {
      console.error("❌ Could not find RetailerRegistry address");
      console.log("\nPlease set RETAILER_REGISTRY_ADDRESS environment variable:");
      console.log("  export RETAILER_REGISTRY_ADDRESS=0x...");
      process.exit(1);
    }
  }

  console.log("  RetailerRegistry:", RETAILER_REGISTRY_ADDRESS);
  console.log("");

  // Get contract instance
  const RetailerRegistry = await hre.ethers.getContractAt(
    "RetailerRegistry",
    RETAILER_REGISTRY_ADDRESS
  );

  console.log("🔄 Starting Authorization Process...");
  console.log("━".repeat(60));

  let successCount = 0;
  let alreadyAuthorizedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < retailerAccounts.length; i++) {
    const accountNumber = 17 + i;
    const retailer = retailerAccounts[i];
    
    console.log(`\n${i + 1}. Authorizing Account ${accountNumber}: ${retailer.address}`);

    try {
      // Check if already authorized
      const isAlreadyAuthorized = await RetailerRegistry.isAuthorizedRetailer(
        manufacturer.address,
        retailer.address
      );

      if (isAlreadyAuthorized) {
        console.log("   ✅ Already authorized - skipping");
        alreadyAuthorizedCount++;
        continue;
      }

      // Authorize the retailer
      const tx = await RetailerRegistry.connect(manufacturer).authorizeRetailer(
        retailer.address
      );
      
      console.log("   📝 Transaction:", tx.hash);
      console.log("   ⏳ Waiting for confirmation...");
      
      const receipt = await tx.wait();
      
      console.log("   ✅ Authorized! (Gas used:", receipt.gasUsed.toString() + ")");
      successCount++;

    } catch (error) {
      console.error("   ❌ Failed:", error.message);
      failedCount++;
    }
  }

  console.log("\n" + "━".repeat(60));
  console.log("📊 Summary:");
  console.log(`   ✅ Newly authorized: ${successCount}`);
  console.log(`   ℹ️  Already authorized: ${alreadyAuthorizedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log("");

  // Verify all authorizations
  console.log("🔍 Verifying all authorizations...");
  for (let i = 0; i < retailerAccounts.length; i++) {
    const accountNumber = 17 + i;
    const retailer = retailerAccounts[i];
    
    const isAuthorized = await RetailerRegistry.isAuthorizedRetailer(
      manufacturer.address,
      retailer.address
    );

    const status = isAuthorized ? "✅" : "❌";
    console.log(`   ${status} Account ${accountNumber}: ${retailer.address}`);
  }

  console.log("\n🎉 Authorization Complete!");
  console.log("\n💡 You can now transfer products to these retailers:");
  retailerAccounts.forEach((retailer, idx) => {
    console.log(`   Account ${17 + idx}: ${retailer.address}`);
  });
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
