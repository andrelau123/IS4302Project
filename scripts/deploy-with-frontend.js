const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying contracts...");

  // Get signers
  const [deployer, treasury] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy AuthToken
  console.log("\nDeploying AuthToken...");
  const AuthToken = await ethers.getContractFactory("AuthToken");
  const authToken = await AuthToken.deploy();
  await authToken.waitForDeployment();
  
  console.log("AuthToken deployed to:", authToken.target);

  // Deploy FeeDistributor
  console.log("\nDeploying FeeDistributor...");
  const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
  const feeDistributor = await FeeDistributor.deploy(
    authToken.target,
    treasury.address,
    deployer.address
  );
  await feeDistributor.waitForDeployment();
  
  console.log("FeeDistributor deployed to:", feeDistributor.target);

  // Create frontend environment file
  const envContent = `# Contract addresses
REACT_APP_FEE_DISTRIBUTOR_ADDRESS=${feeDistributor.target}
REACT_APP_AUTH_TOKEN_ADDRESS=${authToken.target}

# Network configuration
REACT_APP_CHAIN_ID=31337
REACT_APP_NETWORK_NAME=Hardhat Local
REACT_APP_RPC_URL=http://127.0.0.1:8545
`;

  const frontendDir = path.join(__dirname, "frontend");
  if (fs.existsSync(frontendDir)) {
    fs.writeFileSync(path.join(frontendDir, ".env"), envContent);
    console.log("\nFrontend .env file created with contract addresses");
  }

  // Update constants file
  const constantsPath = path.join(__dirname, "frontend", "src", "utils", "constants.js");
  if (fs.existsSync(constantsPath)) {
    let constantsContent = fs.readFileSync(constantsPath, "utf8");
    constantsContent = constantsContent.replace(
      /FEE_DISTRIBUTOR: process\.env\.REACT_APP_FEE_DISTRIBUTOR_ADDRESS \|\| '0x\.\.\.'/,
      `FEE_DISTRIBUTOR: '${feeDistributor.target}'`
    );
    constantsContent = constantsContent.replace(
      /AUTH_TOKEN: process\.env\.REACT_APP_AUTH_TOKEN_ADDRESS \|\| '0x\.\.\.'/,
      `AUTH_TOKEN: '${authToken.target}'`
    );
    fs.writeFileSync(constantsPath, constantsContent);
    console.log("Constants file updated with contract addresses");
  }

  // Transfer some tokens to test accounts for demo purposes
  console.log("\nTransferring tokens for demo...");
  const amount = ethers.parseEther("1000");
  
  // Transfer to treasury
  await authToken.transfer(treasury.address, amount);
  console.log(`Transferred ${ethers.formatEther(amount)} AUTH tokens to treasury`);

  console.log("\nDeployment completed!");
  console.log("=".repeat(50));
  console.log("Contract Addresses:");
  console.log("AuthToken:", authToken.target);
  console.log("FeeDistributor:", feeDistributor.target);
  console.log("=".repeat(50));
  console.log("\nTo start the frontend:");
  console.log("1. cd frontend");
  console.log("2. npm install");
  console.log("3. npm start");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
