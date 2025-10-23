const { ethers } = require("hardhat");
const marketplaceConfig = require('../frontend/src/marketplaceConfig.json');

async function main() {
  console.log("\n🔍 Checking Marketplace Listings Status...\n");

  // Get marketplace contract
  const marketplace = await ethers.getContractAt(
    "Marketplace",
    marketplaceConfig.marketplace
  );

  console.log("Marketplace:", marketplaceConfig.marketplace);
  console.log("\n" + "=".repeat(70));
  console.log("NFT LISTING STATUS");
  console.log("=".repeat(70) + "\n");

  const listings = marketplaceConfig.listings;

  for (const item of listings) {
    const listing = await marketplace.getListing(item.tokenId);
    const isListed = await marketplace.isListed(item.tokenId);
    
    console.log(`Token #${item.tokenId} - ${item.name}`);
    console.log(`  Price: ${item.price} ETH`);
    console.log(`  Seller: ${item.seller}`);
    console.log(`  Status: ${isListed ? '✅ AVAILABLE' : '❌ SOLD/UNLISTED'}`);
    
    if (!isListed && listing.active === false) {
      // Get current owner
      try {
        const productNFT = await ethers.getContractAt(
          "ProductNFT",
          marketplaceConfig.productNFT
        );
        const owner = await productNFT.ownerOf(item.tokenId);
        console.log(`  Current Owner: ${owner}`);
      } catch (e) {
        console.log(`  Current Owner: Unknown`);
      }
    }
    console.log("");
  }

  console.log("=".repeat(70));
  
  const availableCount = (await Promise.all(
    listings.map(item => marketplace.isListed(item.tokenId))
  )).filter(Boolean).length;
  
  console.log(`\n📊 Summary: ${availableCount}/${listings.length} NFTs still available for purchase\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

