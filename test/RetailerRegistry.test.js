const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RetailerRegistry", function () {
  let retailerRegistry;
  let owner, brandManager, retailer1, retailer2, brand1, brand2;
  let BRAND_MANAGER_ROLE;

  beforeEach(async function () {
    [owner, brandManager, retailer1, retailer2, brand1, brand2] = await ethers.getSigners();
    
    const RetailerRegistry = await ethers.getContractFactory("RetailerRegistry");
    retailerRegistry = await RetailerRegistry.deploy();
    
    BRAND_MANAGER_ROLE = await retailerRegistry.BRAND_MANAGER_ROLE();
    
    // Grant brand manager role
    await retailerRegistry.grantRole(BRAND_MANAGER_ROLE, brandManager.address);
  });

  describe("Deployment", function () {
    it("Should grant admin and brand manager roles to deployer", async function () {
      expect(await retailerRegistry.hasRole(await retailerRegistry.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await retailerRegistry.hasRole(BRAND_MANAGER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Retailer Registration", function () {
    it("Should allow brand manager to register retailer", async function () {
      const retailerName = "Test Retailer 1";
      
      await expect(retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, retailerName))
        .to.emit(retailerRegistry, "RetailerRegistered")
        .withArgs(retailer1.address, retailerName);
      
      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.isAuthorized).to.be.true;
      expect(retailer.retailerAddress).to.equal(retailer1.address);
      expect(retailer.name).to.equal(retailerName);
      expect(retailer.reputationScore).to.equal(100); // Default initial score
      expect(retailer.totalVerifications).to.equal(0);
      expect(retailer.failedVerifications).to.equal(0);
    });

    it("Should not allow registering same retailer twice", async function () {
      const retailerName = "Test Retailer 1";
      
      await retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, retailerName);
      
      await expect(retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, "Different Name"))
        .to.be.revertedWith("Already registered");
    });

    it("Should not allow non-brand-manager to register retailer", async function () {
      const retailerName = "Test Retailer 1";
      
      await expect(retailerRegistry.connect(retailer1).registerRetailer(retailer1.address, retailerName))
        .to.be.reverted;
    });

    it("Should set correct initial values for new retailer", async function () {
      const retailerName = "Test Retailer 1";
      const blockTimestamp = await ethers.provider.getBlock("latest").then(block => block.timestamp);
      
      await retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, retailerName);
      
      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.reputationScore).to.equal(100);
      expect(retailer.totalVerifications).to.equal(0);
      expect(retailer.failedVerifications).to.equal(0);
      expect(retailer.registeredAt).to.be.closeTo(blockTimestamp, 5);
    });
  });

  describe("Brand Authorization", function () {
    beforeEach(async function () {
      // Register retailers first
      await retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, "Retailer 1");
      await retailerRegistry.connect(brandManager).registerRetailer(retailer2.address, "Retailer 2");
    });

    it("Should allow brand manager to authorize retailer for brand", async function () {
      await expect(retailerRegistry.connect(brandManager).authorizeRetailerForBrand(brand1.address, retailer1.address))
        .to.emit(retailerRegistry, "RetailerAuthorized")
        .withArgs(brand1.address, retailer1.address);
      
      expect(await retailerRegistry.brandAuthorizations(brand1.address, retailer1.address)).to.be.true;
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, retailer1.address)).to.be.true;
    });

    it("Should allow different retailers for same brand", async function () {
      await retailerRegistry.connect(brandManager).authorizeRetailerForBrand(brand1.address, retailer1.address);
      await retailerRegistry.connect(brandManager).authorizeRetailerForBrand(brand1.address, retailer2.address);
      
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, retailer1.address)).to.be.true;
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, retailer2.address)).to.be.true;
    });

    it("Should allow same retailer for different brands", async function () {
      await retailerRegistry.connect(brandManager).authorizeRetailerForBrand(brand1.address, retailer1.address);
      await retailerRegistry.connect(brandManager).authorizeRetailerForBrand(brand2.address, retailer1.address);
      
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, retailer1.address)).to.be.true;
      expect(await retailerRegistry.isAuthorizedRetailer(brand2.address, retailer1.address)).to.be.true;
    });

    it("Should not authorize unregistered retailer", async function () {
      const unregisteredRetailer = ethers.Wallet.createRandom().address;
      
      await expect(retailerRegistry.connect(brandManager).authorizeRetailerForBrand(brand1.address, unregisteredRetailer))
        .to.be.revertedWith("Retailer not registered");
    });

    it("Should not allow non-brand-manager to authorize", async function () {
      await expect(retailerRegistry.connect(retailer1).authorizeRetailerForBrand(brand1.address, retailer1.address))
        .to.be.reverted;
    });

    it("Should allow deauthorization of retailer", async function () {
      // First authorize
      await retailerRegistry.connect(brandManager).authorizeRetailerForBrand(brand1.address, retailer1.address);
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, retailer1.address)).to.be.true;
      
      // Then deauthorize
      await expect(retailerRegistry.connect(brandManager).deauthorizeRetailerForBrand(brand1.address, retailer1.address))
        .to.emit(retailerRegistry, "RetailerDeauthorized")
        .withArgs(brand1.address, retailer1.address);
      
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, retailer1.address)).to.be.false;
    });
  });

  describe("Reputation Management", function () {
    beforeEach(async function () {
      await retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, "Retailer 1");
    });

    it("Should update reputation correctly for successful verification", async function () {
      await expect(retailerRegistry.connect(brandManager).updateReputation(retailer1.address, true))
        .to.emit(retailerRegistry, "ReputationUpdated")
        .withArgs(retailer1.address, 100);
      
      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.totalVerifications).to.equal(1);
      expect(retailer.failedVerifications).to.equal(0);
      expect(retailer.reputationScore).to.equal(100); // 100% success rate
    });

    it("Should update reputation correctly for failed verification", async function () {
      await expect(retailerRegistry.connect(brandManager).updateReputation(retailer1.address, false))
        .to.emit(retailerRegistry, "ReputationUpdated")
        .withArgs(retailer1.address, 0);
      
      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.totalVerifications).to.equal(1);
      expect(retailer.failedVerifications).to.equal(1);
      expect(retailer.reputationScore).to.equal(0); // 0% success rate
    });

    it("Should calculate reputation correctly with mixed results", async function () {
      // 3 successful, 1 failed = 75% success rate
      await retailerRegistry.connect(brandManager).updateReputation(retailer1.address, true);
      await retailerRegistry.connect(brandManager).updateReputation(retailer1.address, true);
      await retailerRegistry.connect(brandManager).updateReputation(retailer1.address, false);
      await retailerRegistry.connect(brandManager).updateReputation(retailer1.address, true);
      
      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.totalVerifications).to.equal(4);
      expect(retailer.failedVerifications).to.equal(1);
      expect(retailer.reputationScore).to.equal(75); // 75% success rate
    });

    it("Should handle multiple consecutive updates", async function () {
      // Start with some successful verifications
      await retailerRegistry.connect(brandManager).updateReputation(retailer1.address, true);
      await retailerRegistry.connect(brandManager).updateReputation(retailer1.address, true);
      
      let retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.reputationScore).to.equal(100);
      
      // Add a failure
      await retailerRegistry.connect(brandManager).updateReputation(retailer1.address, false);
      
      retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.totalVerifications).to.equal(3);
      expect(retailer.failedVerifications).to.equal(1);
      expect(retailer.reputationScore).to.equal(66); // 2/3 = 66.67% rounded down
    });

    it("Should not allow reputation update for unregistered retailer", async function () {
      const unregisteredRetailer = ethers.Wallet.createRandom().address;
      
      await expect(retailerRegistry.connect(brandManager).updateReputation(unregisteredRetailer, true))
        .to.be.revertedWith("Retailer not registered");
    });

    it("Should not allow non-brand-manager to update reputation", async function () {
      await expect(retailerRegistry.connect(retailer1).updateReputation(retailer1.address, true))
        .to.be.reverted;
    });
  });

  describe("Authorization Query", function () {
    beforeEach(async function () {
      await retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, "Retailer 1");
      await retailerRegistry.connect(brandManager).registerRetailer(retailer2.address, "Retailer 2");
    });

    it("Should return false for unregistered retailer", async function () {
      const unregisteredRetailer = ethers.Wallet.createRandom().address;
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, unregisteredRetailer)).to.be.false;
    });

    it("Should return false for registered but unauthorized retailer", async function () {
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, retailer1.address)).to.be.false;
    });

    it("Should return true only for authorized retailer-brand combinations", async function () {
      await retailerRegistry.connect(brandManager).authorizeRetailerForBrand(brand1.address, retailer1.address);
      
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, retailer1.address)).to.be.true;
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, retailer2.address)).to.be.false;
      expect(await retailerRegistry.isAuthorizedRetailer(brand2.address, retailer1.address)).to.be.false;
    });

    it("Should handle complex authorization matrix", async function () {
      // Create authorization matrix:
      // Brand1: Retailer1 ✓, Retailer2 ✗
      // Brand2: Retailer1 ✗, Retailer2 ✓
      
      await retailerRegistry.connect(brandManager).authorizeRetailerForBrand(brand1.address, retailer1.address);
      await retailerRegistry.connect(brandManager).authorizeRetailerForBrand(brand2.address, retailer2.address);
      
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, retailer1.address)).to.be.true;
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, retailer2.address)).to.be.false;
      expect(await retailerRegistry.isAuthorizedRetailer(brand2.address, retailer1.address)).to.be.false;
      expect(await retailerRegistry.isAuthorizedRetailer(brand2.address, retailer2.address)).to.be.true;
    });
  });

  describe("Pausable Functionality", function () {
    it("Should allow admin to pause and unpause", async function () {
      await retailerRegistry.pause();
      expect(await retailerRegistry.paused()).to.be.true;
      
      await retailerRegistry.unpause();
      expect(await retailerRegistry.paused()).to.be.false;
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(retailerRegistry.connect(retailer1).pause())
        .to.be.reverted;
    });

    it("Should prevent operations when paused", async function () {
      await retailerRegistry.pause();
      
      await expect(retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, "Test"))
        .to.be.revertedWithCustomError(retailerRegistry, "EnforcedPause");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle empty retailer name", async function () {
      await expect(retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, ""))
        .to.not.be.reverted; // Empty names should be allowed
      
      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.name).to.equal("");
    });

    it("Should handle zero address as brand (edge case)", async function () {
      await retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, "Retailer 1");
      
      // This should work but practically might not make sense
      await retailerRegistry.connect(brandManager).authorizeRetailerForBrand(ethers.ZeroAddress, retailer1.address);
      expect(await retailerRegistry.isAuthorizedRetailer(ethers.ZeroAddress, retailer1.address)).to.be.true;
    });

    it("Should handle reputation calculations correctly at boundaries", async function () {
      await retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, "Retailer 1");
      
      // Test edge case: 99 successful + 1 failed = 99% success rate
      for (let i = 0; i < 99; i++) {
        await retailerRegistry.connect(brandManager).updateReputation(retailer1.address, true);
      }
      await retailerRegistry.connect(brandManager).updateReputation(retailer1.address, false);
      
      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.totalVerifications).to.equal(100);
      expect(retailer.failedVerifications).to.equal(1);
      expect(retailer.reputationScore).to.equal(99);
    });

    it("Should maintain state consistency after deauthorization and reauthorization", async function () {
      await retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, "Retailer 1");
      
      // Authorize, deauthorize, and reauthorize
      await retailerRegistry.connect(brandManager).authorizeRetailerForBrand(brand1.address, retailer1.address);
      await retailerRegistry.connect(brandManager).deauthorizeRetailerForBrand(brand1.address, retailer1.address);
      await retailerRegistry.connect(brandManager).authorizeRetailerForBrand(brand1.address, retailer1.address);
      
      expect(await retailerRegistry.isAuthorizedRetailer(brand1.address, retailer1.address)).to.be.true;
      
      // Retailer data should remain intact
      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.isAuthorized).to.be.true;
      expect(retailer.name).to.equal("Retailer 1");
    });
  });
});
