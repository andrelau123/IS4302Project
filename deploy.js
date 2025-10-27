// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  console.log("Deploying Supply-Chain Authenticity suite...");

  const [deployer] = await hre.ethers.getSigners();
  const treasury = deployer.address; // or set a separate treasury wallet

  //Deploy AuthToken (utility + staking) - No dependencies
  const AuthToken = await hre.ethers.getContractFactory("AuthToken");
  const authToken = await AuthToken.deploy();
  await authToken.waitForDeployment();
  console.log(`AuthToken deployed at: ${authToken.target}`);

  //Deploy RetailerRegistry - No dependencies
  const RetailerRegistry = await hre.ethers.getContractFactory("RetailerRegistry");
  const retailerRegistry = await RetailerRegistry.deploy();
  await retailerRegistry.waitForDeployment();
  console.log(`RetailerRegistry deployed at: ${retailerRegistry.target}`);

  //Deploy ProductRegistry - Requires RetailerRegistry
  const ProductRegistry = await hre.ethers.getContractFactory("ProductRegistry");
  const productRegistry = await ProductRegistry.deploy(
    retailerRegistry.target,
    deployer.address // admin
  );
  await productRegistry.waitForDeployment();
  console.log(`ProductRegistry deployed at: ${productRegistry.target}`);

  //Deploy FeeDistributor (authToken + treasury + admin)
  const FeeDistributor = await hre.ethers.getContractFactory("FeeDistributor");
  const feeDistributor = await FeeDistributor.deploy(
    authToken.target,
    treasury,
    deployer.address // admin
  );
  await feeDistributor.waitForDeployment();
  console.log(`FeeDistributor deployed at: ${feeDistributor.target}`);


  //Deploy ProductNFT (requires ProductRegistry and RetailerRegistry)
  const ProductNFT = await hre.ethers.getContractFactory("ProductNFT");
  const productNFT = await ProductNFT.deploy(
    productRegistry.target,
    retailerRegistry.target
  );
  await productNFT.waitForDeployment();
  console.log(`ProductNFT deployed at: ${productNFT.target}`);

  //Set roles / wiring between contracts
  console.log("🔧 Configuring roles...");

  // Give FeeDistributor distributor role to deployer for now
  const DISTRIBUTOR_ROLE = await feeDistributor.DISTRIBUTOR_ROLE();
  await feeDistributor.grantRole(DISTRIBUTOR_ROLE, deployer.address);

  // Give ProductNFT minter role to deployer
  const MINTER_ROLE = await productNFT.MINTER_ROLE();
  await productNFT.grantRole(MINTER_ROLE, deployer.address);

  console.log("Roles configured successfully!");

  // Display summary
  console.log(`
  📜 Deployment Summary:
  ─────────────────────────────
  AuthToken       : ${authToken.target}
  RetailerRegistry: ${retailerRegistry.target}
  ProductRegistry : ${productRegistry.target}
  FeeDistributor  : ${feeDistributor.target}
  ProductNFT      : ${productNFT.target}
  Treasury Wallet : ${treasury}
  Deployer        : ${deployer.address}
  `);
}

// Recommended Hardhat pattern
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Deployment failed:", err);
    process.exit(1);
  });
