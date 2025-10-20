const { ethers } = require("hardhat");

async function main() {
  console.log("\n🚀 Setting Up Marketplace for NFT Trading...\n");

  const [deployer, seller1, seller2, seller3, buyer] = await ethers.getSigners();
  
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Step 1: Deploy all necessary contracts
  console.log("📦 Step 1: Deploying Contracts...\n");
  
  // Deploy AuthToken
  const AuthToken = await ethers.getContractFactory("AuthToken");
  const authToken = await AuthToken.deploy();
  await authToken.waitForDeployment();
  const authTokenAddress = await authToken.getAddress();
  console.log("✅ AuthToken:", authTokenAddress);

  // Deploy RetailerRegistry first (ProductRegistry depends on it)
  const RetailerRegistry = await ethers.getContractFactory("RetailerRegistry");
  const retailerRegistry = await RetailerRegistry.deploy();
  await retailerRegistry.waitForDeployment();
  const retailerRegistryAddress = await retailerRegistry.getAddress();
  console.log("✅ RetailerRegistry:", retailerRegistryAddress);

  // Deploy ProductRegistry (needs retailerRegistry address)
  const ProductRegistry = await ethers.getContractFactory("ProductRegistry");
  const productRegistry = await ProductRegistry.deploy(retailerRegistryAddress, deployer.address);
  await productRegistry.waitForDeployment();
  const productRegistryAddress = await productRegistry.getAddress();
  console.log("✅ ProductRegistry:", productRegistryAddress);

  // Deploy FeeDistributor
  const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
  const feeDistributor = await FeeDistributor.deploy(
    authTokenAddress,
    deployer.address, // treasury
    deployer.address  // admin
  );
  await feeDistributor.waitForDeployment();
  const feeDistributorAddress = await feeDistributor.getAddress();
  console.log("✅ FeeDistributor:", feeDistributorAddress);

  // Deploy ProductNFT
  const ProductNFT = await ethers.getContractFactory("ProductNFT");
  const productNFT = await ProductNFT.deploy(
    productRegistryAddress,
    retailerRegistryAddress
  );
  await productNFT.waitForDeployment();
  const productNFTAddress = await productNFT.getAddress();
  console.log("✅ ProductNFT:", productNFTAddress);

  // Deploy Marketplace
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(
    productNFTAddress,
    feeDistributorAddress
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("✅ Marketplace:", marketplaceAddress);

  // Step 2: Configure permissions
  console.log("\n🔑 Step 2: Configuring Permissions...\n");
  
  const MINTER_ROLE = await productNFT.MINTER_ROLE();
  await productNFT.grantRole(MINTER_ROLE, deployer.address);
  console.log("✅ Granted MINTER_ROLE to deployer");
  
  // Grant MANUFACTURER_ROLE to sellers so they can register products
  const MANUFACTURER_ROLE = await productRegistry.MANUFACTURER_ROLE();
  await productRegistry.grantRole(MANUFACTURER_ROLE, seller1.address);
  await productRegistry.grantRole(MANUFACTURER_ROLE, seller2.address);
  await productRegistry.grantRole(MANUFACTURER_ROLE, seller3.address);
  console.log("✅ Granted MANUFACTURER_ROLE to sellers");
  
  // Disable transfer restrictions for easier testing
  await productNFT.setTransferRestrictions(false);
  console.log("✅ Disabled transfer restrictions");

  // Whitelist marketplace anyway
  await productNFT.setWhitelistedAddress(marketplaceAddress, true);
  console.log("✅ Whitelisted Marketplace");

  // Step 3: Mint and list NFTs
  console.log("\n🎨 Step 3: Creating Test NFT Listings...\n");
  
  const testItems = [
    { name: "Premium Coffee Beans", price: "0.5", seller: seller1 },
    { name: "Organic Cotton T-Shirt", price: "0.3", seller: seller2 },
    { name: "Artisan Leather Wallet", price: "0.8", seller: seller3 },
    { name: "Handmade Ceramic Mug", price: "0.2", seller: seller1 }
  ];

  const listings = [];

  for (let i = 0; i < testItems.length; i++) {
    const { name, price, seller } = testItems[i];
    
    console.log(`${i + 1}. ${name}`);
    
    // Register product first (seller must do this)
    const metadataURI = `ipfs://Qm${name.replace(/\s+/g, '')}-${i}`;
    const registerTx = await productRegistry.connect(seller).registerProduct(metadataURI);
    const registerReceipt = await registerTx.wait();
    
    // Get productId from event
    const registerEvent = registerReceipt.logs.find(log => {
      try {
        const parsed = productRegistry.interface.parseLog(log);
        return parsed && parsed.name === "ProductRegistered";
      } catch {
        return false;
      }
    });
    
    const productId = registerEvent ? productRegistry.interface.parseLog(registerEvent).args.productId : ethers.id(`${name}-${i}`);
    console.log(`   • Registered product: ${productId.slice(0, 10)}...`);
    
    // Mint NFT (deployer has MINTER_ROLE)
    const mintTx = await productNFT.mintProductNFT(productId, seller.address);
    const mintReceipt = await mintTx.wait();
    
    // Get tokenId from mint event
    const mintEvent = mintReceipt.logs.find(log => {
      try {
        const parsed = productNFT.interface.parseLog(log);
        return parsed && parsed.name === "ProductNFTMinted";
      } catch {
        return false;
      }
    });
    
    const tokenId = mintEvent ? productNFT.interface.parseLog(mintEvent).args.tokenId : BigInt(i + 1);
    console.log(`   • Minted token #${tokenId} to ${seller.address.slice(0, 10)}...`);
    
    // Approve marketplace
    await productNFT.connect(seller).approve(marketplaceAddress, tokenId);
    console.log(`   • Approved marketplace`);
    
    // Create listing
    const priceWei = ethers.parseEther(price);
    await marketplace.connect(seller).createListing(tokenId, priceWei);
    console.log(`   • Listed for ${price} ETH ✅\n`);
    
    listings.push({ tokenId: tokenId.toString(), name, price, seller: seller.address });
  }

  // Save addresses for frontend
  console.log("=".repeat(70));
  console.log("✅ MARKETPLACE READY FOR USE!");
  console.log("=".repeat(70));
  
  console.log("\n📋 CONTRACT ADDRESSES:\n");
  console.log(`   AuthToken:        ${authTokenAddress}`);
  console.log(`   ProductRegistry:  ${productRegistryAddress}`);
  console.log(`   RetailerRegistry: ${retailerRegistryAddress}`);
  console.log(`   FeeDistributor:   ${feeDistributorAddress}`);
  console.log(`   ProductNFT:       ${productNFTAddress}`);
  console.log(`   Marketplace:      ${marketplaceAddress}`);

  console.log("\n🏪 ACTIVE LISTINGS:\n");
  listings.forEach((item, i) => {
    console.log(`   ${i + 1}. Token #${item.tokenId} - ${item.name}`);
    console.log(`      Price: ${item.price} ETH`);
    console.log(`      Seller: ${item.seller}\n`);
  });

  // Write to file
  const fs = require('fs');
  const config = {
    marketplace: marketplaceAddress,
    productNFT: productNFTAddress,
    authToken: authTokenAddress,
    feeDistributor: feeDistributorAddress,
    productRegistry: productRegistryAddress,
    retailerRegistry: retailerRegistryAddress,
    listings
  };
  
  fs.writeFileSync(
    './frontend/src/marketplaceConfig.json',
    JSON.stringify(config, null, 2)
  );
  
  console.log("📝 Configuration saved to: frontend/src/marketplaceConfig.json");
  console.log("\n💡 Now update your frontend to use these addresses!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

