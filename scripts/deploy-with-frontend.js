const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying contracts...");

  // Get signers
  const [deployer, treasury] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log(
    "Account balance:",
    (await deployer.provider.getBalance(deployer.address)).toString()
  );

  // Deploy AuthToken
  console.log("\nDeploying AuthToken...");
  const AuthToken = await ethers.getContractFactory("AuthToken");
  const authToken = await AuthToken.deploy();
  await authToken.waitForDeployment();

  console.log("AuthToken deployed to:", authToken.target);

  // Deploy RetailerRegistry (no args)
  console.log("\nDeploying RetailerRegistry...");
  const RetailerRegistry = await ethers.getContractFactory("RetailerRegistry");
  const retailerRegistry = await RetailerRegistry.deploy();
  await retailerRegistry.waitForDeployment();
  console.log("RetailerRegistry deployed to:", retailerRegistry.target);

  // Deploy ProductRegistry (needs retailerRegistry, admin)
  console.log("\nDeploying ProductRegistry...");
  const ProductRegistry = await ethers.getContractFactory("ProductRegistry");
  const productRegistry = await ProductRegistry.deploy(
    retailerRegistry.target,
    deployer.address
  );
  await productRegistry.waitForDeployment();
  console.log("ProductRegistry deployed to:", productRegistry.target);

  // Deploy ProductNFT (needs productRegistry, retailerRegistry)
  console.log("\nDeploying ProductNFT...");
  const ProductNFT = await ethers.getContractFactory("ProductNFT");
  const productNFT = await ProductNFT.deploy(
    productRegistry.target,
    retailerRegistry.target
  );
  await productNFT.waitForDeployment();
  console.log("ProductNFT deployed to:", productNFT.target);

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

  // Deploy VerificationManager (authToken, productRegistry, feeDistributor)
  console.log("\nDeploying VerificationManager...");
  const VerificationManager = await ethers.getContractFactory(
    "VerificationManager"
  );
  const verificationManager = await VerificationManager.deploy(
    authToken.target,
    productRegistry.target,
    feeDistributor.target
  );
  await verificationManager.waitForDeployment();
  console.log("VerificationManager deployed to:", verificationManager.target);

  // Deploy OracleIntegration (admin)
  console.log("\nDeploying OracleIntegration...");
  const OracleIntegration = await ethers.getContractFactory(
    "OracleIntegration"
  );
  const oracleIntegration = await OracleIntegration.deploy(deployer.address);
  await oracleIntegration.waitForDeployment();
  console.log("OracleIntegration deployed to:", oracleIntegration.target);

  // Deploy DisputeResolution (productRegistry, authToken)
  console.log("\nDeploying DisputeResolution...");
  const DisputeResolution = await ethers.getContractFactory(
    "DisputeResolution"
  );
  const disputeResolution = await DisputeResolution.deploy(
    productRegistry.target,
    authToken.target
  );
  await disputeResolution.waitForDeployment();
  console.log("DisputeResolution deployed to:", disputeResolution.target);

  // Deploy GovernanceVoting (authToken, admin)
  console.log("\nDeploying GovernanceVoting...");
  const GovernanceVoting = await ethers.getContractFactory("GovernanceVoting");
  const governanceVoting = await GovernanceVoting.deploy(
    authToken.target,
    deployer.address
  );
  await governanceVoting.waitForDeployment();
  console.log("GovernanceVoting deployed to:", governanceVoting.target);

  // Deploy Marketplace (productNFT, feeRecipient)
  console.log("\nDeploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(
    productNFT.target,
    treasury.address
  );
  await marketplace.waitForDeployment();
  console.log("Marketplace deployed to:", marketplace.target);

  // Configure roles and cross-contract permissions
  console.log("\nConfiguring contract roles and permissions...");

  // Grant MINTER_ROLE to deployer for ProductNFT (safe even if constructor already set it)
  try {
    const MINTER_ROLE = await productNFT.MINTER_ROLE();
    const hasMinter = await productNFT.hasRole(MINTER_ROLE, deployer.address);
    if (!hasMinter) {
      console.log("Granting MINTER_ROLE to deployer on ProductNFT...");
      const tx = await productNFT.grantRole(MINTER_ROLE, deployer.address);
      await tx.wait();
      console.log("\u2705 MINTER_ROLE granted to deployer on ProductNFT");
    } else {
      console.log("Deployer already has MINTER_ROLE on ProductNFT");
    }
  } catch (err) {
    console.warn(
      "Could not grant MINTER_ROLE on ProductNFT:",
      err?.message || err
    );
  }

  // Whitelist marketplace for NFT transfers (if function exists)
  try {
    if (
      typeof productNFT.setWhitelistedAddress === "function" ||
      productNFT.setWhitelistedAddress
    ) {
      console.log(
        "Whitelisting Marketplace address on ProductNFT for transfers..."
      );
      const tx = await productNFT.setWhitelistedAddress(
        marketplace.target,
        true
      );
      await tx.wait();
      console.log("\u2705 Marketplace whitelisted on ProductNFT");
    }
  } catch (err) {
    // fallback: ignore if method is not present or failed
    console.warn(
      "Could not whitelist marketplace on ProductNFT:",
      err?.message || err
    );
  }

  // Grant TRANSFER_VALIDATOR_ROLE on ProductNFT to Marketplace so it can move tokens on sales
  try {
    const TRANSFER_VALIDATOR_ROLE = await productNFT.TRANSFER_VALIDATOR_ROLE();
    const hasValidator = await productNFT.hasRole(
      TRANSFER_VALIDATOR_ROLE,
      marketplace.target
    );
    if (!hasValidator) {
      console.log(
        "Granting TRANSFER_VALIDATOR_ROLE to Marketplace on ProductNFT..."
      );
      const tx = await productNFT.grantRole(
        TRANSFER_VALIDATOR_ROLE,
        marketplace.target
      );
      await tx.wait();
      console.log("\u2705 TRANSFER_VALIDATOR_ROLE granted to Marketplace");
    } else {
      console.log(
        "Marketplace already has TRANSFER_VALIDATOR_ROLE on ProductNFT"
      );
    }
  } catch (err) {
    console.warn(
      "Could not grant TRANSFER_VALIDATOR_ROLE on ProductNFT:",
      err?.message || err
    );
  }

  // Grant MANUFACTURER_ROLE on ProductRegistry to deployer (so deployer can register products in demos)
  try {
    const MANUFACTURER_ROLE = await productRegistry.MANUFACTURER_ROLE();
    const hasManu = await productRegistry.hasRole(
      MANUFACTURER_ROLE,
      deployer.address
    );
    if (!hasManu) {
      console.log(
        "Granting MANUFACTURER_ROLE to deployer on ProductRegistry..."
      );
      const tx = await productRegistry.grantRole(
        MANUFACTURER_ROLE,
        deployer.address
      );
      await tx.wait();
      console.log(
        "\u2705 MANUFACTURER_ROLE granted to deployer on ProductRegistry"
      );
    } else {
      console.log("Deployer already has MANUFACTURER_ROLE on ProductRegistry");
    }
  } catch (err) {
    console.warn(
      "Could not grant MANUFACTURER_ROLE on ProductRegistry:",
      err?.message || err
    );
  }

  // Grant DISTRIBUTOR_ROLE on FeeDistributor to VerificationManager so it can distribute fees
  try {
    const DISTRIBUTOR_ROLE = await feeDistributor.DISTRIBUTOR_ROLE();
    const hasDistributor = await feeDistributor.hasRole(
      DISTRIBUTOR_ROLE,
      verificationManager.target
    );
    if (!hasDistributor) {
      console.log(
        "Granting DISTRIBUTOR_ROLE on FeeDistributor to VerificationManager..."
      );
      const tx = await feeDistributor.grantRole(
        DISTRIBUTOR_ROLE,
        verificationManager.target
      );
      await tx.wait();
      console.log(
        "\u2705 DISTRIBUTOR_ROLE granted to VerificationManager on FeeDistributor"
      );
    } else {
      console.log(
        "VerificationManager already has DISTRIBUTOR_ROLE on FeeDistributor"
      );
    }
  } catch (err) {
    console.warn(
      "Could not grant DISTRIBUTOR_ROLE on FeeDistributor:",
      err?.message || err
    );
  }

  // Create frontend environment file with all deployed addresses
  const envContent = `# Contract addresses
REACT_APP_AUTH_TOKEN_ADDRESS=${authToken.target}
REACT_APP_FEE_DISTRIBUTOR_ADDRESS=${feeDistributor.target}
REACT_APP_PRODUCT_REGISTRY_ADDRESS=${productRegistry.target}
REACT_APP_RETAILER_REGISTRY_ADDRESS=${retailerRegistry.target}
REACT_APP_PRODUCT_NFT_ADDRESS=${productNFT.target}
REACT_APP_VERIFICATION_MANAGER_ADDRESS=${verificationManager.target}
REACT_APP_ORACLE_INTEGRATION_ADDRESS=${oracleIntegration.target}
REACT_APP_DISPUTE_RESOLUTION_ADDRESS=${disputeResolution.target}
REACT_APP_GOVERNANCE_VOTING_ADDRESS=${governanceVoting.target}
REACT_APP_MARKETPLACE_ADDRESS=${marketplace.target}

# Network configuration
REACT_APP_CHAIN_ID=31337
REACT_APP_NETWORK_NAME=Hardhat Local
REACT_APP_RPC_URL=http://127.0.0.1:8545
`;

  const frontendDir = path.join(__dirname, "..", "frontend");
  if (fs.existsSync(frontendDir)) {
    fs.writeFileSync(path.join(frontendDir, ".env"), envContent);
    console.log("\nFrontend .env file created with contract addresses");
  }

  // Update constants file
  const constantsPath = path.join(
    __dirname,
    "..",
    "frontend",
    "src",
    "utils",
    "constants.js"
  );
  if (fs.existsSync(constantsPath)) {
    let constantsContent = fs.readFileSync(constantsPath, "utf8");

    const replacements = {
      AUTH_TOKEN: authToken.target,
      FEE_DISTRIBUTOR: feeDistributor.target,
      PRODUCT_REGISTRY: productRegistry.target,
      RETAILER_REGISTRY: retailerRegistry.target,
      PRODUCT_NFT: productNFT.target,
      VERIFICATION_MANAGER: verificationManager.target,
      ORACLE_INTEGRATION: oracleIntegration.target,
      DISPUTE_RESOLUTION: disputeResolution.target,
      GOVERNANCE_VOTING: governanceVoting.target,
      MARKETPLACE: marketplace.target,
    };

    Object.entries(replacements).forEach(([key, addr]) => {
      const regex = new RegExp(
        `${key}:\\s*process\\.env\\\.REACT_APP_${key}_ADDRESS\\s*\\|\\|\\s*'0x\\.\\.\\.'`
      );
      if (regex.test(constantsContent)) {
        constantsContent = constantsContent.replace(regex, `${key}: '${addr}'`);
      } else {
        // Fallback: replace simple default '0x...' occurrences for that key if present
        constantsContent = constantsContent.replace(
          new RegExp(`${key}:\\s*'0x\\.\\.\\.'`),
          `${key}: '${addr}'`
        );
      }
    });

    fs.writeFileSync(constantsPath, constantsContent);
    console.log("Constants file updated with contract addresses");
  }

  // Transfer some tokens to test accounts for demo purposes
  console.log("\nTransferring tokens for demo...");
  const amount = ethers.parseEther("1000");

  // Transfer to treasury
  await authToken.transfer(treasury.address, amount);
  console.log(
    `Transferred ${ethers.formatEther(amount)} AUTH tokens to treasury`
  );

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
