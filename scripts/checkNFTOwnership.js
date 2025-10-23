const { ethers } = require("hardhat");
const marketplaceConfig = require('../frontend/src/marketplaceConfig.json');

async function main() {
  const userAddress = "0x05A20A51a39C93D3bfDc4c26406FbCf9561Cdab9";
  
  console.log("\n🔍 Checking NFT Ownership for:", userAddress, "\n");
  
  const productNFT = await ethers.getContractAt(
    "ProductNFT",
    marketplaceConfig.productNFT
  );
  
  console.log("ProductNFT Contract:", marketplaceConfig.productNFT);
  console.log("\n" + "=".repeat(70));
  
  let ownedCount = 0;
  
  // Check tokens 1-10
  for (let tokenId = 1; tokenId <= 10; tokenId++) {
    try {
      const owner = await productNFT.ownerOf(tokenId);
      const isOwner = owner.toLowerCase() === userAddress.toLowerCase();
      
      if (isOwner) {
        ownedCount++;
        console.log(`\n✅ Token #${tokenId}:`);
        console.log(`   Owner: ${owner}`);
        console.log(`   Status: YOU OWN THIS`);
      }
    } catch (e) {
      if (!e.message.includes('ERC721NonexistentToken')) {
        console.log(`\n❌ Token #${tokenId}: Error - ${e.message}`);
      }
    }
  }
  
  console.log("\n" + "=".repeat(70));
  console.log(`\n📊 Total NFTs Owned: ${ownedCount}\n`);
  
  if (ownedCount === 0) {
    console.log("⚠️  You don't own any NFTs yet. Purchase some from the marketplace!\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

