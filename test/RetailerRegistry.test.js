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
      expect(retailer.reputationScore).to.equal(500); // Starts at middle score (0-1000 scale)
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
      expect(retailer.reputationScore).to.equal(500); // New retailers start at 500 (neutral)
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
  await retailerRegistry.setRequireProductLink(false);
    const VERIFICATION_MANAGER_ROLE = await retailerRegistry.VERIFICATION_MANAGER_ROLE();
    await retailerRegistry.grantRole(VERIFICATION_MANAGER_ROLE, brandManager.address);
    });

    it("Should update reputation correctly for successful verification", async function () {
  const tx = await retailerRegistry.connect(brandManager).processVerificationResult(
        ethers.id("v1"),
        ethers.id("p1"),
        retailer1.address,
        true
      );
      const receipt = await tx.wait();

      // ReputationUpdated event should be present
      const event = receipt.logs.find(log => {
        try {
          return retailerRegistry.interface.parseLog(log).name === "ReputationUpdated";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;

      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.totalVerifications).to.equal(1);
      expect(retailer.failedVerifications).to.equal(0);
      expect(retailer.consecutiveSuccesses).to.equal(1);
      // Reputation is now composite score, not simple percentage
      expect(retailer.reputationScore).to.be.greaterThan(500); // Should improve from initial 500
    });

    it("Should update reputation correctly for failed verification", async function () {
      const tx = await retailerRegistry.connect(brandManager).processVerificationResult(
        ethers.id("v2"),
        ethers.id("p2"),
        retailer1.address,
        false
      );
      const receipt = await tx.wait();

      // Check that ReputationUpdated event was emitted
      const event = receipt.logs.find(log => {
        try {
          return retailerRegistry.interface.parseLog(log).name === "ReputationUpdated";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;

      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.totalVerifications).to.equal(1);
      expect(retailer.failedVerifications).to.equal(1);
      expect(retailer.consecutiveSuccesses).to.equal(0); // Reset on failure
      // Reputation should drop from initial 500
      expect(retailer.reputationScore).to.be.lessThan(500);
    });

    it("Should calculate reputation correctly with mixed results", async function () {
      // 3 successful, 1 failed = 75% success rate
      // But with multi-factor system, final score includes tenure, volume, etc.
  await retailerRegistry.connect(brandManager).processVerificationResult(ethers.id("v3"), ethers.id("p3"), retailer1.address, true);
  await ethers.provider.send("evm_increaseTime", [3601]);
  await ethers.provider.send("evm_mine");

  await retailerRegistry.connect(brandManager).processVerificationResult(ethers.id("v4"), ethers.id("p4"), retailer1.address, true);
  await ethers.provider.send("evm_increaseTime", [3601]);
  await ethers.provider.send("evm_mine");

  await retailerRegistry.connect(brandManager).processVerificationResult(ethers.id("v5"), ethers.id("p5"), retailer1.address, false);
  await ethers.provider.send("evm_increaseTime", [3601]);
  await ethers.provider.send("evm_mine");

  await retailerRegistry.connect(brandManager).processVerificationResult(ethers.id("v6"), ethers.id("p6"), retailer1.address, true);
      
      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.totalVerifications).to.equal(4);
      expect(retailer.failedVerifications).to.equal(1);
      
      expect(retailer.reputationScore).to.be.greaterThan(400);
      expect(retailer.reputationScore).to.be.lessThan(700);
    });

    it("Should handle multiple consecutive updates", async function () {
      // Start with some successful verifications
  await retailerRegistry.connect(brandManager).processVerificationResult(ethers.id("v7"), ethers.id("p7"), retailer1.address, true);
  await ethers.provider.send("evm_increaseTime", [3601]);
  await ethers.provider.send("evm_mine");
  await retailerRegistry.connect(brandManager).processVerificationResult(ethers.id("v8"), ethers.id("p8"), retailer1.address, true);
  await ethers.provider.send("evm_increaseTime", [3601]);
  await ethers.provider.send("evm_mine");
      
      let retailer = await retailerRegistry.retailers(retailer1.address);
      const scoreAfterTwoSuccess = retailer.reputationScore;
      expect(scoreAfterTwoSuccess).to.be.greaterThan(500);
      
  // Add a failure
  await retailerRegistry.connect(brandManager).processVerificationResult(ethers.id("v9"), ethers.id("p9"), retailer1.address, false);
      
      retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.totalVerifications).to.equal(3);
      expect(retailer.failedVerifications).to.equal(1);
      expect(retailer.consecutiveSuccesses).to.equal(0); // Reset by failure
      // Score should be lower than after two successes
      expect(retailer.reputationScore).to.be.lessThan(scoreAfterTwoSuccess);
    });

    it("Should not allow reputation update for unregistered retailer", async function () {
      const unregisteredRetailer = ethers.Wallet.createRandom().address;

      await expect(
        retailerRegistry.connect(brandManager).processVerificationResult(
          ethers.id("vx"),
          ethers.id("px"),
          unregisteredRetailer,
          true
        )
      ).to.be.revertedWith("Retailer not registered");
    });

    it("Should not allow non-brand-manager to update reputation", async function () {
      await expect(
        retailerRegistry.connect(retailer1).processVerificationResult(
          ethers.id("vn"),
          ethers.id("pn"),
          retailer1.address,
          true
        )
      ).to.be.reverted;
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
        .to.be.revertedWith("Empty name");
      // Retailer should not be registered
      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.isAuthorized).to.equal(false);
    });

    it("Should handle zero address as brand (edge case)", async function () {
      await retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, "Retailer 1");
      
      // This should revert because zero address is not a valid brand
      await expect(retailerRegistry.connect(brandManager).authorizeRetailerForBrand(ethers.ZeroAddress, retailer1.address))
        .to.be.revertedWith("Zero brand address");
    });

    it("Should handle reputation calculations correctly at boundaries", async function () {
      await retailerRegistry.connect(brandManager).registerRetailer(retailer1.address, "Retailer 1");

      // Reduce volume threshold to speed up impact of volume on score
      await retailerRegistry.setVolumeTierThreshold(10);

      // Grant verification manager role for this test and perform 9 successful verifications and 1 failure (10 total)
      const VERIFICATION_MANAGER_ROLE = await retailerRegistry.VERIFICATION_MANAGER_ROLE();
      await retailerRegistry.grantRole(VERIFICATION_MANAGER_ROLE, brandManager.address);

      // Perform 9 successful verifications and 1 failure (10 total)
      for (let i = 0; i < 9; i++) {
        await retailerRegistry.connect(brandManager).processVerificationResult(ethers.id(`vb${i}`), ethers.id(`pb${i}`), retailer1.address, true);
        await ethers.provider.send("evm_increaseTime", [3601]);
        await ethers.provider.send("evm_mine");
      }
      await retailerRegistry.connect(brandManager).processVerificationResult(ethers.id("vb_fail"), ethers.id("pb_fail"), retailer1.address, false);

      const retailer = await retailerRegistry.retailers(retailer1.address);
      expect(retailer.totalVerifications).to.equal(10);
      expect(retailer.failedVerifications).to.equal(1);
      // With high success rate and some volume, score should be above neutral but below perfect
      expect(retailer.reputationScore).to.be.greaterThan(500);
      expect(retailer.reputationScore).to.be.lessThan(900);
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
