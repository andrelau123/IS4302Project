const { ethers } = require("hardhat");
const marketplaceConfig = require('../frontend/src/marketplaceConfig.json');

async function main() {
  const targetAddress = "0x05a20a51a39c93d3bfdc4c26406fbcf9561cdab9"; // Your MetaMask address
  
  console.log("\n🔑 Granting MANUFACTURER_ROLE...\n");
  console.log("Target Address:", targetAddress);
  
  const [deployer] = await ethers.getSigners();
  console.log("Granting from:", deployer.address);
  
  // Get ProductRegistry contract
  const productRegistry = await ethers.getContractAt(
    "ProductRegistry",
    marketplaceConfig.productRegistry
  );
  
  // Get MANUFACTURER_ROLE
  const MANUFACTURER_ROLE = await productRegistry.MANUFACTURER_ROLE();
  console.log("MANUFACTURER_ROLE:", MANUFACTURER_ROLE);
  
  // Check if already has role
  const hasRole = await productRegistry.hasRole(MANUFACTURER_ROLE, targetAddress);
  
  if (hasRole) {
    console.log("\n✅ Address already has MANUFACTURER_ROLE\n");
  } else {
    console.log("\n⏳ Granting role...");
    const tx = await productRegistry.grantRole(MANUFACTURER_ROLE, targetAddress);
    await tx.wait();
    console.log("✅ MANUFACTURER_ROLE granted successfully!\n");
  }
  
  // Verify
  const verifyHasRole = await productRegistry.hasRole(MANUFACTURER_ROLE, targetAddress);
  console.log("Verification:", verifyHasRole ? "✅ Has role" : "❌ Does not have role");
  console.log("\n🎉 You can now register products!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

