const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProductNFT", function () {
  let productNFT;
  let productRegistry;
  let retailerRegistry;
  let owner, minter, brand, retailer, buyer, marketplace, user;
  let MINTER_ROLE, TRANSFER_VALIDATOR_ROLE, BRAND_MANAGER_ROLE, MANUFACTURER_ROLE;
  let productId;

  beforeEach(async function () {
    [owner, minter, brand, retailer, buyer, marketplace, user] = await ethers.getSigners();

    // Deploy RetailerRegistry first
    const RetailerRegistry = await ethers.getContractFactory("RetailerRegistry");
    retailerRegistry = await RetailerRegistry.deploy();

    // Deploy ProductRegistry
    const ProductRegistry = await ethers.getContractFactory("ProductRegistry");
    productRegistry = await ProductRegistry.deploy(retailerRegistry.target, owner.address);

    // Deploy ProductNFT
    const ProductNFT = await ethers.getContractFactory("ProductNFT");
    productNFT = await ProductNFT.deploy(productRegistry.target, retailerRegistry.target);

    // Get role constants
    MINTER_ROLE = await productNFT.MINTER_ROLE();
    TRANSFER_VALIDATOR_ROLE = await productNFT.TRANSFER_VALIDATOR_ROLE();
    BRAND_MANAGER_ROLE = await retailerRegistry.BRAND_MANAGER_ROLE();
    MANUFACTURER_ROLE = await productRegistry.MANUFACTURER_ROLE();

    // Setup roles
    await productNFT.grantRole(MINTER_ROLE, minter.address);
    await productRegistry.grantRole(MANUFACTURER_ROLE, brand.address);
    await retailerRegistry.grantRole(BRAND_MANAGER_ROLE, brand.address);

    // Register and authorize retailer
    await retailerRegistry.connect(brand).registerRetailer(retailer.address, "Authorized Retailer");
    await retailerRegistry.connect(brand).authorizeRetailerForBrand(brand.address, retailer.address);

    // Register a product
    const tx = await productRegistry.connect(brand).registerProduct("ipfs://test-metadata");
    const receipt = await tx.wait();
    const event = receipt.logs.find(log => {
      try {
        return productRegistry.interface.parseLog(log).name === "ProductRegistered";
      } catch {
        return false;
      }
    });
    productId = event.args[0];
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await productNFT.name()).to.equal("Authentic Product NFT");
      expect(await productNFT.symbol()).to.equal("AUTH-NFT");
    });

    it("Should set correct contract references", async function () {
      expect(await productNFT.productRegistry()).to.equal(productRegistry.target);
      expect(await productNFT.retailerRegistry()).to.equal(retailerRegistry.target);
    });

    it("Should grant admin and minter roles to deployer", async function () {
      expect(await productNFT.hasRole(await productNFT.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await productNFT.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });

    it("Should set default transfer restrictions", async function () {
      expect(await productNFT.transferRestrictionsEnabled()).to.be.true;
      expect(await productNFT.requireRetailerAuthorization()).to.be.true;
    });

    it("Should set default royalty", async function () {
      expect(await productNFT.royaltyPercentage()).to.equal(250);
      expect(await productNFT.royaltyReceiver()).to.equal(owner.address);
    });

    it("Should not deploy with zero address", async function () {
      const ProductNFT = await ethers.getContractFactory("ProductNFT");
      await expect(ProductNFT.deploy(ethers.ZeroAddress, retailerRegistry.target))
        .to.be.revertedWith("Invalid ProductRegistry");
      await expect(ProductNFT.deploy(productRegistry.target, ethers.ZeroAddress))
        .to.be.revertedWith("Invalid RetailerRegistry");
    });
  });

  describe("Minting", function () {
    it("Should allow minter to mint NFT for authentic product", async function () {
      await expect(productNFT.connect(minter).mintProductNFT(productId, retailer.address))
        .to.emit(productNFT, "ProductNFTMinted");

      expect(await productNFT.ownerOf(1)).to.equal(retailer.address);
      expect(await productNFT.nftToProductId(1)).to.equal(productId);
      expect(await productNFT.productIdToNFT(productId)).to.equal(1);
    });

    it("Should not allow non-minter to mint", async function () {
      await expect(productNFT.connect(user).mintProductNFT(productId, retailer.address))
        .to.be.reverted;
    });

    it("Should not allow minting duplicate NFT for same product", async function () {
      await productNFT.connect(minter).mintProductNFT(productId, retailer.address);
      
      await expect(productNFT.connect(minter).mintProductNFT(productId, retailer.address))
        .to.be.revertedWith("NFT already exists");
    });

    it("Should not allow minting for non-authentic product", async function () {
      const fakeProductId = ethers.id("fake-product");
      
      await expect(productNFT.connect(minter).mintProductNFT(fakeProductId, retailer.address))
        .to.be.revertedWith("Product not authentic");
    });

    it("Should initialize transfer history on mint", async function () {
      await productNFT.connect(minter).mintProductNFT(productId, retailer.address);
      
      const history = await productNFT.getTransferHistory(1);
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(ethers.ZeroAddress);
      expect(history[0].to).to.equal(retailer.address);
    });

    it("Should not allow minting when paused", async function () {
      await productNFT.pause();
      
      await expect(productNFT.connect(minter).mintProductNFT(productId, retailer.address))
        .to.be.revertedWithCustomError(productNFT, "EnforcedPause");
    });
  });

  describe("Transfer Restrictions", function () {
    beforeEach(async function () {
      await productNFT.connect(minter).mintProductNFT(productId, retailer.address);
    });

    it("Should allow transfer to authorized retailer", async function () {
      // Register another retailer
      await retailerRegistry.connect(brand).registerRetailer(buyer.address, "Another Retailer");
      await retailerRegistry.connect(brand).authorizeRetailerForBrand(brand.address, buyer.address);

      await expect(productNFT.connect(retailer).transferFrom(retailer.address, buyer.address, 1))
        .to.not.be.reverted;
    });

    it("Should not allow transfer to unauthorized address", async function () {
      await expect(productNFT.connect(retailer).transferFrom(retailer.address, user.address, 1))
        .to.be.revertedWith("Recipient not authorized");
    });

    it("Should allow transfer to whitelisted address", async function () {
      await productNFT.setWhitelistedAddress(marketplace.address, true);

      await expect(productNFT.connect(retailer).transferFrom(retailer.address, marketplace.address, 1))
        .to.not.be.reverted;
    });

    it("Should allow transfer when restrictions disabled", async function () {
      await productNFT.setTransferRestrictions(false);

      await expect(productNFT.connect(retailer).transferFrom(retailer.address, user.address, 1))
        .to.not.be.reverted;
    });

    it("Should allow transfer when retailer authorization not required", async function () {
      await productNFT.setRetailerAuthorizationRequirement(false);
      await productNFT.setWhitelistedAddress(user.address, true);

      await expect(productNFT.connect(retailer).transferFrom(retailer.address, user.address, 1))
        .to.not.be.reverted;
    });

    it("Should record transfer in history", async function () {
      await retailerRegistry.connect(brand).registerRetailer(buyer.address, "Buyer Retailer");
      await retailerRegistry.connect(brand).authorizeRetailerForBrand(brand.address, buyer.address);

      await productNFT.connect(retailer).transferFrom(retailer.address, buyer.address, 1);

      const history = await productNFT.getTransferHistory(1);
      expect(history.length).to.equal(2);
      expect(history[1].from).to.equal(retailer.address);
      expect(history[1].to).to.equal(buyer.address);
    });

    it("Should not allow transfer when paused", async function () {
      await productNFT.pause();

      await expect(productNFT.connect(retailer).transferFrom(retailer.address, buyer.address, 1))
        .to.be.revertedWithCustomError(productNFT, "EnforcedPause");
    });
  });

  describe("Whitelist Management", function () {
    it("Should allow admin to whitelist address", async function () {
      await expect(productNFT.setWhitelistedAddress(marketplace.address, true))
        .to.emit(productNFT, "AddressWhitelisted")
        .withArgs(marketplace.address, true);

      expect(await productNFT.whitelistedAddresses(marketplace.address)).to.be.true;
    });

    it("Should allow admin to remove from whitelist", async function () {
      await productNFT.setWhitelistedAddress(marketplace.address, true);
      await productNFT.setWhitelistedAddress(marketplace.address, false);

      expect(await productNFT.whitelistedAddresses(marketplace.address)).to.be.false;
    });

    it("Should not allow non-admin to whitelist", async function () {
      await expect(productNFT.connect(user).setWhitelistedAddress(marketplace.address, true))
        .to.be.reverted;
    });

    it("Should not allow whitelisting zero address", async function () {
      await expect(productNFT.setWhitelistedAddress(ethers.ZeroAddress, true))
        .to.be.revertedWith("Invalid address");
    });

    it("Should allow batch whitelisting", async function () {
      const addresses = [marketplace.address, buyer.address, user.address];
      
      await productNFT.batchSetWhitelistedAddresses(addresses, true);

      for (const addr of addresses) {
        expect(await productNFT.whitelistedAddresses(addr)).to.be.true;
      }
    });
  });

  describe("Royalty Management", function () {
    beforeEach(async function () {
      await productNFT.connect(minter).mintProductNFT(productId, retailer.address);
    });

    it("Should calculate royalty correctly", async function () {
      const salePrice = ethers.parseEther("10");
      const [receiver, royaltyAmount] = await productNFT.royaltyInfo(1, salePrice);

      expect(receiver).to.equal(owner.address);
      expect(royaltyAmount).to.equal(salePrice * 250n / 10000n); // 2.5%
    });

    it("Should allow admin to update royalty info", async function () {
      const newReceiver = brand.address;
      const newPercentage = 500; // 5%

      await expect(productNFT.setRoyaltyInfo(newReceiver, newPercentage))
        .to.emit(productNFT, "RoyaltyInfoUpdated")
        .withArgs(newReceiver, newPercentage);

      expect(await productNFT.royaltyReceiver()).to.equal(newReceiver);
      expect(await productNFT.royaltyPercentage()).to.equal(newPercentage);
    });

    it("Should not allow royalty percentage above 10%", async function () {
      await expect(productNFT.setRoyaltyInfo(brand.address, 1001))
        .to.be.revertedWith("Royalty too high");
    });

    it("Should not allow zero address as royalty receiver", async function () {
      await expect(productNFT.setRoyaltyInfo(ethers.ZeroAddress, 250))
        .to.be.revertedWith("Invalid receiver");
    });

    it("Should support EIP-2981 interface", async function () {
      const EIP2981_INTERFACE_ID = "0x2a55205a";
      expect(await productNFT.supportsInterface(EIP2981_INTERFACE_ID)).to.be.true;
    });
  });

  describe("Sale Price Tracking", function () {
    beforeEach(async function () {
      await productNFT.connect(minter).mintProductNFT(productId, retailer.address);
      await productNFT.grantRole(TRANSFER_VALIDATOR_ROLE, marketplace.address);
    });

    it("Should allow transfer validator to record sale price", async function () {
      const salePrice = ethers.parseEther("5");

      await productNFT.connect(marketplace).recordSalePrice(1, salePrice);

      const history = await productNFT.getTransferHistory(1);
      expect(history[history.length - 1].price).to.equal(salePrice);
    });

    it("Should not allow non-validator to record price", async function () {
      await expect(productNFT.connect(user).recordSalePrice(1, ethers.parseEther("5")))
        .to.be.reverted;
    });

    it("Should not allow recording zero price", async function () {
      await expect(productNFT.connect(marketplace).recordSalePrice(1, 0))
        .to.be.revertedWith("Price must be positive");
    });

    it("Should not allow recording price for non-existent token", async function () {
      await expect(productNFT.connect(marketplace).recordSalePrice(999, ethers.parseEther("5")))
        .to.be.revertedWith("Token does not exist");
    });
  });

  describe("Transfer History", function () {
    beforeEach(async function () {
      await productNFT.connect(minter).mintProductNFT(productId, retailer.address);
    });

    it("Should return correct transfer history", async function () {
      const history = await productNFT.getTransferHistory(1);
      
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(ethers.ZeroAddress);
      expect(history[0].to).to.equal(retailer.address);
    });

    it("Should return correct transfer count", async function () {
      expect(await productNFT.getTransferCount(1)).to.equal(1);
    });

    it("Should not allow getting history for non-existent token", async function () {
      await expect(productNFT.getTransferHistory(999))
        .to.be.revertedWith("Token does not exist");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await productNFT.connect(minter).mintProductNFT(productId, retailer.address);
    });

    it("Should return correct product ID for token", async function () {
      expect(await productNFT.getProductId(1)).to.equal(productId);
    });

    it("Should check if product has NFT", async function () {
      expect(await productNFT.hasNFT(productId)).to.be.true;
      expect(await productNFT.hasNFT(ethers.id("other-product"))).to.be.false;
    });

    it("Should check if address can receive NFT", async function () {
      await retailerRegistry.connect(brand).registerRetailer(buyer.address, "Buyer");
      await retailerRegistry.connect(brand).authorizeRetailerForBrand(brand.address, buyer.address);

      expect(await productNFT.canReceiveNFT(buyer.address, 1)).to.be.true;
      expect(await productNFT.canReceiveNFT(user.address, 1)).to.be.false;
    });

    it("Should return token URI from product metadata", async function () {
      const uri = await productNFT.tokenURI(1);
      expect(uri).to.equal("ipfs://test-metadata");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to enable/disable transfer restrictions", async function () {
      await expect(productNFT.setTransferRestrictions(false))
        .to.emit(productNFT, "TransferRestrictionUpdated")
        .withArgs(false);

      expect(await productNFT.transferRestrictionsEnabled()).to.be.false;
    });

    it("Should allow admin to toggle retailer authorization requirement", async function () {
      await expect(productNFT.setRetailerAuthorizationRequirement(false))
        .to.emit(productNFT, "RetailerAuthorizationRequirementUpdated")
        .withArgs(false);

      expect(await productNFT.requireRetailerAuthorization()).to.be.false;
    });

    it("Should allow admin to pause/unpause", async function () {
      await productNFT.pause();
      expect(await productNFT.paused()).to.be.true;

      await productNFT.unpause();
      expect(await productNFT.paused()).to.be.false;
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(productNFT.connect(user).pause())
        .to.be.reverted;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple transfers correctly", async function () {
      await productNFT.connect(minter).mintProductNFT(productId, retailer.address);
      
      // Disable restrictions for easier testing
      await productNFT.setTransferRestrictions(false);

      // Transfer multiple times
      await productNFT.connect(retailer).transferFrom(retailer.address, buyer.address, 1);
      await productNFT.connect(buyer).transferFrom(buyer.address, user.address, 1);

      const history = await productNFT.getTransferHistory(1);
      expect(history.length).to.equal(3); // Mint + 2 transfers
      expect(await productNFT.ownerOf(1)).to.equal(user.address);
    });

    it("Should handle safe transfer with restrictions", async function () {
      await productNFT.connect(minter).mintProductNFT(productId, retailer.address);
      await retailerRegistry.connect(brand).registerRetailer(buyer.address, "Safe Buyer");
      await retailerRegistry.connect(brand).authorizeRetailerForBrand(brand.address, buyer.address);

      await expect(productNFT.connect(retailer)["safeTransferFrom(address,address,uint256)"](
        retailer.address,
        buyer.address,
        1
      )).to.not.be.reverted;
    });

    it("Should maintain state after pause/unpause cycle", async function () {
      await productNFT.connect(minter).mintProductNFT(productId, retailer.address);
      
      await productNFT.pause();
      await productNFT.unpause();

      expect(await productNFT.ownerOf(1)).to.equal(retailer.address);
      expect(await productNFT.nftToProductId(1)).to.equal(productId);
    });
  });
});

