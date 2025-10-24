const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function readFrontendEnv() {
  const envPath = path.join(__dirname, '..', 'frontend', '.env');
  if (!fs.existsSync(envPath)) throw new Error('frontend/.env not found; run deploy-with-frontend.js first');
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const map = {};
  for (const line of lines) {
    const m = line.match(/^\s*REACT_APP_([A-Z0-9_]+)=(0x[0-9a-fA-F]{40})\s*$/);
    if (m) map[m[1]] = m[2];
  }

  return {
    PRODUCT_REGISTRY: map['PRODUCT_REGISTRY_ADDRESS'],
    PRODUCT_NFT: map['PRODUCT_NFT_ADDRESS'],
    MARKETPLACE: map['MARKETPLACE_ADDRESS'],
    RETAILER_REGISTRY: map['RETAILER_REGISTRY_ADDRESS']
  };
}

async function main() {
  console.log('Starting purchase test...');

  const env = await readFrontendEnv();
  const PRODUCT_REGISTRY = env.PRODUCT_REGISTRY;
  const PRODUCT_NFT = env.PRODUCT_NFT;
  const MARKETPLACE = env.MARKETPLACE;
  const RETAILER_REGISTRY = env.RETAILER_REGISTRY;

  if (!PRODUCT_REGISTRY || !PRODUCT_NFT || !MARKETPLACE || !RETAILER_REGISTRY) {
    throw new Error('Missing one of PRODUCT_REGISTRY/PRODUCT_NFT/MARKETPLACE/RETAILER_REGISTRY in frontend/.env');
  }

  const signers = await ethers.getSigners();
  const seller = signers[0];
  const buyer = signers[signers.length - 1] || signers[1];

  console.log('Seller:', seller.address);
  console.log('Buyer :', buyer.address);

  console.log('\nParsed frontend .env addresses:');
  console.log('PRODUCT_REGISTRY=', PRODUCT_REGISTRY);
  console.log('PRODUCT_NFT     =', PRODUCT_NFT);
  console.log('MARKETPLACE     =', MARKETPLACE);
  console.log('RETAILER_REGISTRY=', RETAILER_REGISTRY);

  const productRegistry = await ethers.getContractAt('ProductRegistry', PRODUCT_REGISTRY);
  const productNFT = await ethers.getContractAt('ProductNFT', PRODUCT_NFT);
  const marketplace = await ethers.getContractAt('Marketplace', MARKETPLACE);
  const retailerRegistry = await ethers.getContractAt('RetailerRegistry', RETAILER_REGISTRY);

  if (!productRegistry || !productRegistry.connect) {
    throw new Error('productRegistry contract instance is invalid');
  }
  if (!productNFT || !productNFT.connect) {
    throw new Error('productNFT contract instance is invalid');
  }
  if (!marketplace || !marketplace.connect) {
    throw new Error('marketplace contract instance is invalid');
  }
  if (!retailerRegistry || !retailerRegistry.connect) {
    throw new Error('retailerRegistry contract instance is invalid');
  }

  // 1) Seller registers a product
  const metadataURI = 'ipfs://test-metadata-' + Date.now();
  console.log('\nRegistering product...');
  const tx1 = await productRegistry.connect(seller).registerProduct(metadataURI);
  const rc1 = await tx1.wait();
  // parse ProductRegistered event to get productId
  let productId;
  try {
    for (const log of rc1.logs || []) {
      try {
        const parsed = productRegistry.interface.parseLog(log);
        if (parsed && parsed.name === 'ProductRegistered') {
          productId = parsed.args[0];
          break;
        }
      } catch (e) {}
    }
  } catch (err) {}
  if (!productId) {
    throw new Error('Could not find ProductRegistered event in tx receipt');
  }
  console.log('Product registered:', productId);

  // 2) Seller mints an NFT for that product
  console.log('\nMinting ProductNFT...');
  const tx2 = await productNFT.connect(seller).mintProductNFT(productId, seller.address);
  const receipt2 = await tx2.wait();
  // parse ProductNFTMinted event
  let tokenId;
  try {
    for (const log of receipt2.logs || []) {
      try {
        const parsed = productNFT.interface.parseLog(log);
        if (parsed && parsed.name === 'ProductNFTMinted') {
          tokenId = parsed.args[0];
          break;
        }
      } catch (e) {}
    }
  } catch (err) {}
  if (!tokenId) {
    throw new Error('Could not find ProductNFTMinted event in mint receipt');
  }
  console.log('Mint tx:', tx2.hash, 'tokenId:', tokenId.toString());

  // 3) Seller approves Marketplace to transfer the token
  console.log('\nApproving marketplace to transfer token...');
  const tx3 = await productNFT.connect(seller).approve(marketplace.target || marketplace.address, tokenId);
  await tx3.wait();
  console.log('Approved marketplace');

  // 4) Seller creates a listing
  const price = ethers.parseEther('0.01');
  console.log('\nCreating listing for tokenId', tokenId.toString(), 'at price', ethers.formatEther(price));
  const tx4 = await marketplace.connect(seller).createListing(tokenId, price);
  await tx4.wait();
  console.log('Listing created:', tx4.hash);

  // 5) Ensure buyer is authorized retailer for the brand (so NFT transfer to buyer is allowed)
  const brand = await productRegistry.getBrandOwner(productId);
  console.log('\nAuthorizing buyer as retailer for brand:', brand);
  const authTx = await retailerRegistry.connect(seller).authorizeRetailerForBrand(brand, buyer.address);
  await authTx.wait();
  console.log('Buyer authorized for brand');

  // Balances before purchase
  const sellerBalBefore = await ethers.provider.getBalance(seller.address);
  const buyerBalBefore = await ethers.provider.getBalance(buyer.address);
  const feeRecipient = await marketplace.feeRecipient();
  const feeRecipientBalBefore = await ethers.provider.getBalance(feeRecipient);

  console.log('\nBalances before purchase:');
  console.log('Seller:', ethers.formatEther(sellerBalBefore));
  console.log('Buyer :', ethers.formatEther(buyerBalBefore));
  console.log('FeeRecipient:', feeRecipient, ethers.formatEther(feeRecipientBalBefore));

  // 6) Buyer purchases the NFT
  console.log('\nPurchasing NFT...');
  const tx5 = await marketplace.connect(buyer).purchaseNFT(tokenId, { value: price });
  const receipt5 = await tx5.wait();
  console.log('Purchase tx:', tx5.hash);

  // 7) Post-purchase checks
  const sellerBalAfter = await ethers.provider.getBalance(seller.address);
  const buyerBalAfter = await ethers.provider.getBalance(buyer.address);
  const feeRecipientBalAfter = await ethers.provider.getBalance(feeRecipient);
  const owner = await productNFT.ownerOf(tokenId);
  const listing = await marketplace.getListing(tokenId);
  const platformFeeBps = await marketplace.platformFeeBps();

  const platformFee = price * BigInt(platformFeeBps) / BigInt(10000);
  const sellerAmount = price - platformFee;

  console.log('\nBalances after purchase:');
  console.log('Seller:', ethers.formatEther(sellerBalAfter));
  console.log('Buyer :', ethers.formatEther(buyerBalAfter));
  console.log('FeeRecipient:', feeRecipient, ethers.formatEther(feeRecipientBalAfter));

  console.log('\nOwnership and listing:');
  console.log('New owner of token', tokenId.toString(), ':', owner);
  console.log('Listing active:', listing.active);

  console.log('\nExpected transfers:');
  console.log('Platform fee (wei):', platformFee.toString());
  console.log('Seller amount (wei):', sellerAmount.toString());

  // Print events from receipt
  console.log('\nEvents emitted in purchase tx:');
  for (const log of receipt5.logs || []) {
    try {
      const parsed = marketplace.interface.parseLog(log);
      console.log('Event:', parsed.name, parsed.args);
    } catch (e) {
      // fallback: print raw
      console.log('Raw log:', log);
    }
  }

  console.log('\nPurchase test completed');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error in purchase-test:', err);
    process.exit(1);
  });
