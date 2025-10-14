const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VerificationManager", function () {
  let verificationManager;
  let authToken;
  let productRegistry;
  let retailerRegistry;
  let feeDistributor;
  let owner, verifier1, verifier2, requester, manufacturer, retailer;
  let VERIFIER_ROLE, MANUFACTURER_ROLE, BRAND_MANAGER_ROLE, DISTRIBUTOR_ROLE;

  beforeEach(async function () {
    [owner, verifier1, verifier2, requester, manufacturer, retailer] = await ethers.getSigners();
    
    // Deploy AuthToken
    const AuthToken = await ethers.getContractFactory("AuthToken");
    authToken = await AuthToken.deploy();
    
    // Deploy RetailerRegistry
    const RetailerRegistry = await ethers.getContractFactory("RetailerRegistry");
    retailerRegistry = await RetailerRegistry.deploy();
    
    // Deploy ProductRegistry
    const ProductRegistry = await ethers.getContractFactory("ProductRegistry");
    productRegistry = await ProductRegistry.deploy(retailerRegistry.target, owner.address);
    
    // Deploy FeeDistributor
    const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
    feeDistributor = await FeeDistributor.deploy(authToken.target, owner.address, owner.address);
    
    // Deploy VerificationManager
    const VerificationManager = await ethers.getContractFactory("VerificationManager");
    verificationManager = await VerificationManager.deploy(
      authToken.target,
      productRegistry.target,
      feeDistributor.target
    );
    
    // Get role constants
    VERIFIER_ROLE = await verificationManager.VERIFIER_ROLE();
    MANUFACTURER_ROLE = await productRegistry.MANUFACTURER_ROLE();
    BRAND_MANAGER_ROLE = await retailerRegistry.BRAND_MANAGER_ROLE();
    DISTRIBUTOR_ROLE = await feeDistributor.DISTRIBUTOR_ROLE();
    
    // Setup roles and initial state
    await productRegistry.grantRole(MANUFACTURER_ROLE, manufacturer.address);
    await retailerRegistry.grantRole(BRAND_MANAGER_ROLE, owner.address);
    await feeDistributor.grantRole(DISTRIBUTOR_ROLE, verificationManager.target);
    
    // Transfer tokens to test accounts
    const stakeAmount = ethers.parseEther("2000");
    const userAmount = ethers.parseEther("1000");
    
    await authToken.transfer(verifier1.address, stakeAmount);
    await authToken.transfer(verifier2.address, stakeAmount);
    await authToken.transfer(requester.address, userAmount);
    
    // Register retailer
    await retailerRegistry.registerRetailer(retailer.address, "Test Retailer");
    await retailerRegistry.authorizeRetailerForBrand(manufacturer.address, retailer.address);
  });

  describe("Deployment", function () {
    it("Should set the correct contract addresses", async function () {
      expect(await verificationManager.authToken()).to.equal(authToken.target);
      expect(await verificationManager.productRegistry()).to.equal(productRegistry.target);
      expect(await verificationManager.feeDistributor()).to.equal(feeDistributor.target);
    });

    it("Should set default parameters correctly", async function () {
      expect(await verificationManager.minVerificationFee()).to.equal(ethers.parseEther("0.1"));
      expect(await verificationManager.maxVerificationFee()).to.equal(ethers.parseEther("1"));
      expect(await verificationManager.minStakeAmount()).to.equal(ethers.parseEther("1000"));
      expect(await verificationManager.verificationTimeout()).to.equal(3 * 24 * 60 * 60); // 3 days
    });
  });

  describe("Verifier Registration", function () {
    it("Should allow users to register as verifiers with sufficient stake", async function () {
      const stakeAmount = ethers.parseEther("1000");
      await authToken.connect(verifier1).approve(verificationManager.target, stakeAmount);
      
      await expect(verificationManager.connect(verifier1).registerVerifier(stakeAmount))
        .to.emit(verificationManager, "VerifierRegistered")
        .withArgs(verifier1.address, stakeAmount);
      
      const verifierInfo = await verificationManager.verifiers(verifier1.address);
      expect(verifierInfo.stakedAmount).to.equal(stakeAmount);
      expect(verifierInfo.isActive).to.be.true;
      expect(await verificationManager.hasRole(VERIFIER_ROLE, verifier1.address)).to.be.true;
    });

    it("Should not allow registration with insufficient stake", async function () {
      const insufficientStake = ethers.parseEther("500");
      await authToken.connect(verifier1).approve(verificationManager.target, insufficientStake);
      
      await expect(verificationManager.connect(verifier1).registerVerifier(insufficientStake))
        .to.be.revertedWith("Insufficient stake");
    });

    it("Should not allow double registration", async function () {
      const stakeAmount = ethers.parseEther("1000");
      await authToken.connect(verifier1).approve(verificationManager.target, stakeAmount * 2n);
      await verificationManager.connect(verifier1).registerVerifier(stakeAmount);
      
      await expect(verificationManager.connect(verifier1).registerVerifier(stakeAmount))
        .to.be.revertedWith("Already registered");
    });

    it("Should transfer tokens to contract on registration", async function () {
      const stakeAmount = ethers.parseEther("1000");
      const initialBalance = await authToken.balanceOf(verifier1.address);
      
      await authToken.connect(verifier1).approve(verificationManager.target, stakeAmount);
      await verificationManager.connect(verifier1).registerVerifier(stakeAmount);
      
      const finalBalance = await authToken.balanceOf(verifier1.address);
      expect(initialBalance - finalBalance).to.equal(stakeAmount);
    });
  });

  describe("Stake Withdrawal", function () {
    beforeEach(async function () {
      const stakeAmount = ethers.parseEther("1000");
      await authToken.connect(verifier1).approve(verificationManager.target, stakeAmount);
      await verificationManager.connect(verifier1).registerVerifier(stakeAmount);
    });

    it("Should allow active verifiers to withdraw stake", async function () {
      const initialBalance = await authToken.balanceOf(verifier1.address);
      const stakeAmount = ethers.parseEther("1000");
      
      await expect(verificationManager.connect(verifier1).withdrawStake())
        .to.emit(verificationManager, "StakeWithdrawn")
        .withArgs(verifier1.address, stakeAmount);
      
      const finalBalance = await authToken.balanceOf(verifier1.address);
      expect(finalBalance - initialBalance).to.equal(stakeAmount);
      
      const verifierInfo = await verificationManager.verifiers(verifier1.address);
      expect(verifierInfo.isActive).to.be.false;
      expect(verifierInfo.stakedAmount).to.equal(0);
      expect(await verificationManager.hasRole(VERIFIER_ROLE, verifier1.address)).to.be.false;
    });

    it("Should not allow inactive verifiers to withdraw", async function () {
      await verificationManager.connect(verifier1).withdrawStake();
      
      await expect(verificationManager.connect(verifier1).withdrawStake())
        .to.be.revertedWith("Not active");
    });
  });

  describe("Verification Requests", function () {
    let productId;

    beforeEach(async function () {
      // Register a product
      const metadataURI = "ipfs://QmTest123";
      const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      productId = productRegistry.interface.parseLog(event).args[0];

      // Register verifier
      const stakeAmount = ethers.parseEther("1000");
      await authToken.connect(verifier1).approve(verificationManager.target, stakeAmount);
      await verificationManager.connect(verifier1).registerVerifier(stakeAmount);
    });

    it("Should allow verification requests for registered products", async function () {
      const productValue = ethers.parseEther("10");
      const fee = await verificationManager.calculateVerificationFee(productValue);
      
      await authToken.connect(requester).approve(verificationManager.target, fee);
      
      await expect(verificationManager.connect(requester).requestVerification(productId, productValue))
        .to.emit(verificationManager, "VerificationRequested");
      
      // Check request was created
      const requestId = ethers.keccak256(
        ethers.solidityPacked(["bytes32", "address", "uint256"], [productId, requester.address, await ethers.provider.getBlockNumber()])
      );
    });

    it("Should not allow requests for non-existent products", async function () {
      const nonExistentId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      const productValue = ethers.parseEther("10");
      const fee = await verificationManager.calculateVerificationFee(productValue);
      
      await authToken.connect(requester).approve(verificationManager.target, fee);
      
      await expect(verificationManager.connect(requester).requestVerification(nonExistentId, productValue))
        .to.be.revertedWith("Product not found");
    });

    it("Should calculate verification fee correctly", async function () {
      const productValue1 = ethers.parseEther("1");
      const productValue2 = ethers.parseEther("100");
      
      const fee1 = await verificationManager.calculateVerificationFee(productValue1);
      const fee2 = await verificationManager.calculateVerificationFee(productValue2);
      
      expect(fee1).to.be.gte(await verificationManager.minVerificationFee());
      expect(fee1).to.be.lte(await verificationManager.maxVerificationFee());
      expect(fee2).to.be.gte(fee1); // Higher value should have higher or equal fee
    });

    it("Should transfer fee to contract on request", async function () {
      const productValue = ethers.parseEther("10");
      const fee = await verificationManager.calculateVerificationFee(productValue);
      const initialBalance = await authToken.balanceOf(requester.address);
      
      await authToken.connect(requester).approve(verificationManager.target, fee);
      await verificationManager.connect(requester).requestVerification(productId, productValue);
      
      const finalBalance = await authToken.balanceOf(requester.address);
      expect(initialBalance - finalBalance).to.equal(fee);
    });
  });

  describe("Verification Assignment", function () {
    let productId, requestId;

    beforeEach(async function () {
      // Register product
      const metadataURI = "ipfs://QmTest123";
      const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      productId = productRegistry.interface.parseLog(event).args[0];

      // Register verifiers
      const stakeAmount = ethers.parseEther("1000");
      await authToken.connect(verifier1).approve(verificationManager.target, stakeAmount);
      await verificationManager.connect(verifier1).registerVerifier(stakeAmount);
      
      await authToken.connect(verifier2).approve(verificationManager.target, stakeAmount);
      await verificationManager.connect(verifier2).registerVerifier(stakeAmount);

      // Create verification request
      const productValue = ethers.parseEther("10");
      const fee = await verificationManager.calculateVerificationFee(productValue);
      await authToken.connect(requester).approve(verificationManager.target, fee);
      
      const requestTx = await verificationManager.connect(requester).requestVerification(productId, productValue);
      const requestReceipt = await requestTx.wait();
      
      const requestEvent = requestReceipt.logs.find(log => {
        try {
          return verificationManager.interface.parseLog(log).name === "VerificationRequested";
        } catch {
          return false;
        }
      });
      requestId = verificationManager.interface.parseLog(requestEvent).args[0];
    });

    it("Should allow admin to assign verifier to request", async function () {
      await expect(verificationManager.assignVerifier(requestId, verifier1.address))
        .to.emit(verificationManager, "VerificationAssigned")
        .withArgs(requestId, verifier1.address);
      
      const request = await verificationManager.requests(requestId);
      expect(request.assignedVerifier).to.equal(verifier1.address);
    });

    it("Should not allow non-admin to assign verifier", async function () {
      await expect(verificationManager.connect(verifier1).assignVerifier(requestId, verifier1.address))
        .to.be.reverted;
    });

    it("Should not allow assignment to inactive verifier", async function () {
      // Deactivate verifier
      await verificationManager.connect(verifier1).withdrawStake();
      
      await expect(verificationManager.assignVerifier(requestId, verifier1.address))
        .to.be.revertedWith("Not a verifier");
    });
  });

  describe("Verification Completion", function () {
    let productId, requestId;

    beforeEach(async function () {
      // Setup complete verification workflow
      const metadataURI = "ipfs://QmTest123";
      const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      productId = productRegistry.interface.parseLog(event).args[0];

      // Register verifier
      const stakeAmount = ethers.parseEther("1000");
      await authToken.connect(verifier1).approve(verificationManager.target, stakeAmount);
      await verificationManager.connect(verifier1).registerVerifier(stakeAmount);

      // Create and assign verification request
      const productValue = ethers.parseEther("10");
      const fee = await verificationManager.calculateVerificationFee(productValue);
      await authToken.connect(requester).approve(verificationManager.target, fee);
      
      const requestTx = await verificationManager.connect(requester).requestVerification(productId, productValue);
      const requestReceipt = await requestTx.wait();
      
      const requestEvent = requestReceipt.logs.find(log => {
        try {
          return verificationManager.interface.parseLog(log).name === "VerificationRequested";
        } catch {
          return false;
        }
      });
      requestId = verificationManager.interface.parseLog(requestEvent).args[0];

      await verificationManager.assignVerifier(requestId, verifier1.address);
    });

    it("Should allow assigned verifier to complete verification", async function () {
      const verificationResult = true;
      const evidenceURI = "ipfs://QmEvidence123";
      
      await expect(verificationManager.connect(verifier1).completeVerification(requestId, verificationResult, evidenceURI))
        .to.emit(verificationManager, "VerificationCompleted")
        .withArgs(requestId, verificationResult, verifier1.address);
      
      const request = await verificationManager.requests(requestId);
      expect(request.completed).to.be.true;
      expect(request.result).to.equal(verificationResult);
    });

    it("Should not allow non-assigned verifier to complete verification", async function () {
      const verificationResult = true;
      const evidenceURI = "ipfs://QmEvidence123";
      
      await expect(verificationManager.connect(verifier2).completeVerification(requestId, verificationResult, evidenceURI))
        .to.be.revertedWithCustomError(verificationManager, "AccessControlUnauthorizedAccount");
    });

    it("Should update verifier statistics on completion", async function () {
      const verificationResult = true;
      const evidenceURI = "ipfs://QmEvidence123";
      
      const initialStats = await verificationManager.verifiers(verifier1.address);
      
      await verificationManager.connect(verifier1).completeVerification(requestId, verificationResult, evidenceURI);
      
      const finalStats = await verificationManager.verifiers(verifier1.address);
      expect(finalStats.totalVerifications).to.equal(initialStats.totalVerifications + 1n);
      expect(finalStats.successfulVerifications).to.equal(initialStats.successfulVerifications + 1n);
    });

    it("Should handle failed verifications correctly", async function () {
      const verificationResult = false;
      const evidenceURI = "ipfs://QmEvidence123";
      
      const initialStats = await verificationManager.verifiers(verifier1.address);
      
      await verificationManager.connect(verifier1).completeVerification(requestId, verificationResult, evidenceURI);
      
      const finalStats = await verificationManager.verifiers(verifier1.address);
      expect(finalStats.totalVerifications).to.equal(initialStats.totalVerifications + 1n);
      expect(finalStats.successfulVerifications).to.equal(initialStats.successfulVerifications); // No increment for failed
    });
  });

  describe("Timeout Handling", function () {
    let productId, requestId;

    beforeEach(async function () {
      // Setup verification request
      const metadataURI = "ipfs://QmTest123";
      const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      productId = productRegistry.interface.parseLog(event).args[0];

      const stakeAmount = ethers.parseEther("1000");
      await authToken.connect(verifier1).approve(verificationManager.target, stakeAmount);
      await verificationManager.connect(verifier1).registerVerifier(stakeAmount);

      const productValue = ethers.parseEther("10");
      const fee = await verificationManager.calculateVerificationFee(productValue);
      await authToken.connect(requester).approve(verificationManager.target, fee);
      
      const requestTx = await verificationManager.connect(requester).requestVerification(productId, productValue);
      const requestReceipt = await requestTx.wait();
      
      const requestEvent = requestReceipt.logs.find(log => {
        try {
          return verificationManager.interface.parseLog(log).name === "VerificationRequested";
        } catch {
          return false;
        }
      });
      requestId = verificationManager.interface.parseLog(requestEvent).args[0];

      await verificationManager.assignVerifier(requestId, verifier1.address);
    });

    it("Should allow timeout handling after verification period expires", async function () {
      // Fast forward past timeout period
      await time.increase(4 * 24 * 60 * 60); // 4 days (longer than 3-day timeout)
      
      await expect(verificationManager.handleTimeout(requestId))
        .to.emit(verificationManager, "VerifierSlashed");
      
      const verifierInfo = await verificationManager.verifiers(verifier1.address);
      expect(verifierInfo.stakedAmount).to.be.lt(ethers.parseEther("1000")); // Should be slashed
    });

    it("Should not allow timeout handling before period expires", async function () {
      await expect(verificationManager.handleTimeout(requestId))
        .to.be.revertedWith("Not timed out");
    });

    it("Should not allow timeout on completed verification", async function () {
      // Complete verification first
      await verificationManager.connect(verifier1).completeVerification(requestId, true, "ipfs://evidence");
      
      // Fast forward past timeout
      await time.increase(4 * 24 * 60 * 60);
      
      await expect(verificationManager.handleTimeout(requestId))
        .to.be.revertedWith("Already completed");
    });
  });

  describe("Parameter Updates", function () {
    it("Should allow admin to update verification parameters", async function () {
      const newMinFee = ethers.parseEther("0.2");
      const newMaxFee = ethers.parseEther("2");
      const newMinStake = ethers.parseEther("2000");
      const newTimeout = 5 * 24 * 60 * 60; // 5 days
      
      await verificationManager.setVerificationFees(newMinFee, newMaxFee);
      await verificationManager.setMinStakeAmount(newMinStake);
      await verificationManager.setVerificationTimeout(newTimeout);
      
      expect(await verificationManager.minVerificationFee()).to.equal(newMinFee);
      expect(await verificationManager.maxVerificationFee()).to.equal(newMaxFee);
      expect(await verificationManager.minStakeAmount()).to.equal(newMinStake);
      expect(await verificationManager.verificationTimeout()).to.equal(newTimeout);
    });

    it("Should not allow non-admin to update parameters", async function () {
      await expect(verificationManager.connect(verifier1).setVerificationFees(
        ethers.parseEther("0.2"), 
        ethers.parseEther("2")
      )).to.be.reverted;
    });

    it("Should validate fee parameters", async function () {
      // Min fee should not be greater than max fee
      await expect(verificationManager.setVerificationFees(
        ethers.parseEther("2"), 
        ethers.parseEther("1")
      )).to.be.revertedWith("Invalid fee range");
    });
  });

  describe("Pausable Functionality", function () {
    it("Should prevent operations when paused", async function () {
      await verificationManager.pause();
      
      const stakeAmount = ethers.parseEther("1000");
      await authToken.connect(verifier1).approve(verificationManager.target, stakeAmount);
      
      await expect(verificationManager.connect(verifier1).registerVerifier(stakeAmount))
        .to.be.revertedWithCustomError(verificationManager, "EnforcedPause");
    });

    it("Should allow admin to pause and unpause", async function () {
      await verificationManager.pause();
      expect(await verificationManager.paused()).to.be.true;
      
      await verificationManager.unpause();
      expect(await verificationManager.paused()).to.be.false;
    });
  });
});
