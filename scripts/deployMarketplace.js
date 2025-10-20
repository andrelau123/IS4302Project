const { ethers } = require("hardhat");

async function main() {
  console.log("\n🚀 Deploying Marketplace and Creating Test Listings...\n");

  const [deployer, seller1, seller2, seller3, seller4] = await ethers.getSigners();
  
  console.log("Deploying from:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Get existing contract addresses (assuming they're already deployed)
  const productRegistryAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const authTokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const retailerRegistryAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const feeDistributorAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  // Deploy or get ProductNFT
  let productNFT;
  try {
    // Try to get existing ProductNFT
    const productNFTAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
    productNFT = await ethers.getContractAt("ProductNFT", productNFTAddress);
    console.log("✅ Using existing ProductNFT at:", productNFTAddress);
  } catch (error) {
    // Deploy new ProductNFT if not exists
    console.log("📦 Deploying ProductNFT...");
    const ProductNFT = await ethers.getContractFactory("ProductNFT");
    productNFT = await ProductNFT.deploy(
      productRegistryAddress,
      retailerRegistryAddress,
      "https://api.productverify.com/nft/"
    );
    await productNFT.waitForDeployment();
    console.log("✅ ProductNFT deployed to:", await productNFT.getAddress());
  }

  const productNFTAddress = await productNFT.getAddress();

  // Deploy Marketplace
  console.log("\n📦 Deploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(
    productNFTAddress,
    feeDistributorAddress // Fee recipient
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  
  console.log("✅ Marketplace deployed to:", marketplaceAddress);

  // Grant MINTER_ROLE to deployer for testing
  const MINTER_ROLE = await productNFT.MINTER_ROLE();
  const hasRole = await productNFT.hasRole(MINTER_ROLE, deployer.address);
  
  if (!hasRole) {
    console.log("\n🔑 Granting MINTER_ROLE to deployer...");
    const tx = await productNFT.grantRole(MINTER_ROLE, deployer.address);
    await tx.wait();
    console.log("✅ MINTER_ROLE granted");
  }

  // Whitelist marketplace for transfers
  console.log("\n🔓 Whitelisting Marketplace for NFT transfers...");
  const whitelistTx = await productNFT.setWhitelistedAddress(marketplaceAddress, true);
  await whitelistTx.wait();
  console.log("✅ Marketplace whitelisted");

  // Mint test NFTs and create listings
  console.log("\n🎨 Minting Test NFTs and Creating Listings...");
  
  const testListings = [
    {
      productId: ethers.id("COFFEE-BEANS-001"),
      price: ethers.parseEther("0.5"),
      seller: seller1,
      name: "Premium Coffee Beans NFT"
    },
    {
      productId: ethers.id("TSHIRT-ORG-001"),
      price: ethers.parseEther("0.3"),
      seller: seller2,
      name: "Organic Cotton T-Shirt NFT"
    },
    {
      productId: ethers.id("WALLET-LEATHER-001"),
      price: ethers.parseEther("0.8"),
      seller: seller3,
      name: "Artisan Leather Wallet NFT"
    },
    {
      productId: ethers.id("MUG-CERAMIC-001"),
      price: ethers.parseEther("0.2"),
      seller: seller4,
      name: "Handmade Ceramic Mug NFT"
    }
  ];

  const listings = [];

  for (let i = 0; i < testListings.length; i++) {
    const { productId, price, seller, name } = testListings[i];
    
    console.log(`\n  ${i + 1}. ${name}`);
    
    // Mint NFT to seller
    const mintTx = await productNFT.mintProductNFT(productId, seller.address);
    const receipt = await mintTx.wait();
    
    // Get tokenId from event
    const mintEvent = receipt.logs.find(log => {
      try {
        const parsed = productNFT.interface.parseLog(log);
        return parsed && parsed.name === "ProductNFTMinted";
      } catch {
        return false;
      }
    });
    
    const tokenId = mintEvent ? productNFT.interface.parseLog(mintEvent).args.tokenId : i + 1;
    
    console.log(`     • Minted tokenId: ${tokenId} to ${seller.address.slice(0, 8)}...`);
    
    // Approve marketplace
    const approveTx = await productNFT.connect(seller).approve(marketplaceAddress, tokenId);
    await approveTx.wait();
    console.log(`     • Approved marketplace`);
    
    // Create listing
    const listTx = await marketplace.connect(seller).createListing(tokenId, price);
    await listTx.wait();
    console.log(`     • Listed for ${ethers.formatEther(price)} ETH`);
    
    listings.push({
      tokenId: tokenId.toString(),
      price: ethers.formatEther(price),
      seller: seller.address
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  
  console.log("\n📋 Contract Addresses:");
  console.log("   ProductNFT:   ", productNFTAddress);
  console.log("   Marketplace:  ", marketplaceAddress);
  
  console.log("\n🏪 Active Listings:");
  listings.forEach((listing, i) => {
    console.log(`   ${i + 1}. Token #${listing.tokenId} - ${listing.price} ETH`);
    console.log(`      Seller: ${listing.seller}`);
  });
  
  console.log("\n💡 To purchase an NFT, update your frontend with:");
  console.log(`   MARKETPLACE_ADDRESS: "${marketplaceAddress}"`);
  console.log(`   PRODUCT_NFT_ADDRESS: "${productNFTAddress}"`);
  
  console.log("\n");
  
  // Write addresses to a file for frontend
  const fs = require('fs');
  const addresses = {
    marketplace: marketplaceAddress,
    productNFT: productNFTAddress,
    authToken: authTokenAddress,
    feeDistributor: feeDistributorAddress,
    listings: listings
  };
  
  fs.writeFileSync(
    './scripts/deployedAddresses.json',
    JSON.stringify(addresses, null, 2)
  );
  console.log("📝 Addresses saved to: scripts/deployedAddresses.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

