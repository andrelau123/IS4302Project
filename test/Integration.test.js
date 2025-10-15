const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Integration Tests - Full Supply Chain Verification System", function () {
  let authToken;
  let productRegistry;
  let retailerRegistry;
  let verificationManager;
  let oracleIntegration;
  let feeDistributor;
  
  let owner, manufacturer, retailer, verifier, brand, oracleSource, consumer;
  let MANUFACTURER_ROLE, VERIFIER_ROLE, BRAND_MANAGER_ROLE, ORACLE_ADMIN_ROLE;

  beforeEach(async function () {
    [owner, manufacturer, retailer, verifier, brand, oracleSource, consumer] = await ethers.getSigners();
    
    // Deploy all contracts
    const AuthToken = await ethers.getContractFactory("AuthToken");
    authToken = await AuthToken.deploy();
    
    const RetailerRegistry = await ethers.getContractFactory("RetailerRegistry");
    retailerRegistry = await RetailerRegistry.deploy();
    
    const ProductRegistry = await ethers.getContractFactory("ProductRegistry");
    productRegistry = await ProductRegistry.deploy(retailerRegistry.target, owner.address);
    
    const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
    feeDistributor = await FeeDistributor.deploy(authToken.target, owner.address, owner.address);
    
    const VerificationManager = await ethers.getContractFactory("VerificationManager");
    verificationManager = await VerificationManager.deploy(
      authToken.target,
      productRegistry.target,
      feeDistributor.target
    );
    
    const OracleIntegration = await ethers.getContractFactory("OracleIntegration");
    oracleIntegration = await OracleIntegration.deploy(owner.address);
    
    // Get role constants
    MANUFACTURER_ROLE = await productRegistry.MANUFACTURER_ROLE();
    VERIFIER_ROLE = await verificationManager.VERIFIER_ROLE();
    BRAND_MANAGER_ROLE = await retailerRegistry.BRAND_MANAGER_ROLE();
    ORACLE_ADMIN_ROLE = await oracleIntegration.ORACLE_ADMIN_ROLE();
    
    // Setup roles
    await productRegistry.grantRole(MANUFACTURER_ROLE, manufacturer.address);
    await retailerRegistry.grantRole(BRAND_MANAGER_ROLE, owner.address);
    await feeDistributor.grantRole(await feeDistributor.DISTRIBUTOR_ROLE(), verificationManager.target);
    
    // Distribute tokens
    const largeAmount = ethers.parseEther("10000");
    await authToken.transfer(verifier.address, largeAmount);
    await authToken.transfer(consumer.address, largeAmount);
    await authToken.transfer(manufacturer.address, largeAmount);
    
    // Setup retailer authorization
    await retailerRegistry.registerRetailer(retailer.address, "Authorized Retailer");
    await retailerRegistry.authorizeRetailerForBrand(manufacturer.address, retailer.address);
    
    // Register oracle source
    await oracleIntegration.registerSource(oracleSource.address, 0, 200); // IoT source with weight 200
  });

  describe("Complete Product Lifecycle with Verification", function () {
    it("Should handle complete product journey from manufacturing to consumer", async function () {
      // Step 1: Manufacturer registers a product
      const metadataURI = "ipfs://QmProductMetadata123";
      const productTx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const productReceipt = await productTx.wait();
      
      const productEvent = productReceipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      const productId = productRegistry.interface.parseLog(productEvent).args[0];
      
      // Verify product is registered
      expect(await productRegistry.isRegistered(productId)).to.be.true;
      const product = await productRegistry.products(productId);
      expect(product.manufacturer).to.equal(manufacturer.address);
      expect(product.status).to.equal(0); // Registered
      
      // Step 2: Product is transferred to retailer
      await productRegistry.connect(manufacturer).transferProduct(
        productId,
        retailer.address,
        "Distribution Center",
        ethers.keccak256(ethers.toUtf8Bytes("transfer_proof"))
      );
      
      // Step 3: Update product status to AtRetailer (retailer is now owner)
      await productRegistry.connect(retailer).updateStatus(productId, 2); // AtRetailer
      
      // Step 4: Verifier stakes and registers
      const stakeAmount = ethers.parseEther("1000");
      await authToken.connect(verifier).approve(verificationManager.target, stakeAmount);
      await verificationManager.connect(verifier).registerVerifier(stakeAmount);
      
      // Step 5: Consumer requests verification
      const productValue = ethers.parseEther("50");
      const verificationFee = await verificationManager.calculateVerificationFee(productValue);
      await authToken.connect(consumer).approve(verificationManager.target, verificationFee);
      
      const verificationTx = await verificationManager.connect(consumer).requestVerification(productId, productValue);
      const verificationReceipt = await verificationTx.wait();
      
      const verificationEvent = verificationReceipt.logs.find(log => {
        try {
          return verificationManager.interface.parseLog(log).name === "VerificationRequested";
        } catch {
          return false;
        }
      });
      const requestId = verificationManager.interface.parseLog(verificationEvent).args[0];
      
      // Step 6: Admin assigns verifier
      await verificationManager.assignVerifier(requestId, verifier.address);
      
      // Step 7: Verifier completes verification
      await verificationManager.connect(verifier).completeVerification(
        requestId,
        true, // Successful verification
        "ipfs://QmVerificationEvidence"
      );
      
      // Step 8: Verify the verification was completed
      const request = await verificationManager.requests(requestId);
      expect(request.completed).to.be.true;
      expect(request.result).to.be.true;
      
      // Step 9: Check fee distribution occurred
      const verifierInfo = await feeDistributor.verifierInfo(verifier.address);
      expect(verifierInfo.pending).to.be.gt(0);
      
      // Step 10: Update product status to AtRetailer
      const updatedProduct = await productRegistry.products(productId);
      expect(updatedProduct.currentOwner).to.equal(retailer.address);
      
      // Step 11: Product is sold to consumer
      await productRegistry.connect(manufacturer).updateStatus(productId, 3); // Sold
      
      // Verify final product state
      const finalProduct = await productRegistry.products(productId);
      expect(finalProduct.status).to.equal(3); // Sold
    });
  });

  describe("Oracle Integration Workflow", function () {
    it("Should integrate oracle attestations with verification process", async function () {
      // Setup: Register product and create verification request
      const productTx = await productRegistry.connect(manufacturer).registerProduct("ipfs://QmTest");
      const productReceipt = await productTx.wait();
      const productEvent = productReceipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      const productId = productRegistry.interface.parseLog(productEvent).args[0];
      
      // Register verifier
      const stakeAmount = ethers.parseEther("1000");
      await authToken.connect(verifier).approve(verificationManager.target, stakeAmount);
      await verificationManager.connect(verifier).registerVerifier(stakeAmount);
      
      // Request verification
      const productValue = ethers.parseEther("30");
      const verificationFee = await verificationManager.calculateVerificationFee(productValue);
      await authToken.connect(consumer).approve(verificationManager.target, verificationFee);
      
      const verificationTx = await verificationManager.connect(consumer).requestVerification(productId, productValue);
      const verificationReceipt = await verificationTx.wait();
      const verificationEvent = verificationReceipt.logs.find(log => {
        try {
          return verificationManager.interface.parseLog(log).name === "VerificationRequested";
        } catch {
          return false;
        }
      });
      const requestId = verificationManager.interface.parseLog(verificationEvent).args[0];
      
      // Oracle provides attestation
      const domain = {
        name: "OracleIntegration",
        version: "1",
        chainId: 31337,
        verifyingContract: oracleIntegration.target
      };
      
      const types = {
        Attestation: [
          { name: "requestId", type: "bytes32" },
          { name: "productId", type: "bytes32" },
          { name: "verdict", type: "bool" },
          { name: "evidenceURI", type: "string" },
          { name: "readingCode", type: "uint256" },
          { name: "readingValue", type: "int256" },
          { name: "timestamp", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "nonce", type: "uint256" }
        ]
      };
      
      const attestation = {
        requestId: requestId,
        productId: productId,
        verdict: true,
        evidenceURI: "ipfs://QmOracleEvidence",
        readingCode: 1, // Temperature reading
        readingValue: 22, // 22°C
        timestamp: await time.latest(),
        deadline: (await time.latest()) + 3600,
        nonce: await oracleIntegration.nonces(oracleSource.address)
      };
      
      const signature = await oracleSource.signTypedData(domain, types, attestation);
      await oracleIntegration.submitAttestation(attestation, signature);
      
      // Check oracle aggregation
      const [quorumReached, passed] = await oracleIntegration.getAggregate(requestId);
      expect(quorumReached).to.be.true; // Weight 200 >= quorum 200
      expect(passed).to.be.true; // 100% pass rate
      
      // Complete verification using oracle data
      await verificationManager.assignVerifier(requestId, verifier.address);
      await verificationManager.connect(verifier).completeVerification(requestId, true, "ipfs://QmFinalEvidence");
      
      // Verify integration worked
      const request = await verificationManager.requests(requestId);
      expect(request.completed).to.be.true;
      expect(request.result).to.be.true;
    });
  });

  describe("Reputation and Reward System", function () {
    it("Should track reputation and distribute rewards correctly", async function () {
      // Setup multiple verifiers
      const verifier2 = ethers.Wallet.createRandom().connect(ethers.provider);
      await owner.sendTransaction({ to: verifier2.address, value: ethers.parseEther("1") });
      await authToken.transfer(verifier2.address, ethers.parseEther("5000"));
      
      // Register both verifiers
      const stakeAmount = ethers.parseEther("1000");
      await authToken.connect(verifier).approve(verificationManager.target, stakeAmount);
      await verificationManager.connect(verifier).registerVerifier(stakeAmount);
      
      await authToken.connect(verifier2).approve(verificationManager.target, stakeAmount);
      await verificationManager.connect(verifier2).registerVerifier(stakeAmount);
      
      // Create multiple products and verifications
      const products = [];
      const requests = [];
      
      for (let i = 0; i < 3; i++) {
        // Register product
        const productTx = await productRegistry.connect(manufacturer).registerProduct(`ipfs://QmProduct${i}`);
        const productReceipt = await productTx.wait();
        const productEvent = productReceipt.logs.find(log => {
          try {
            return productRegistry.interface.parseLog(log).name === "ProductRegistered";
          } catch {
            return false;
          }
        });
        const productId = productRegistry.interface.parseLog(productEvent).args[0];
        products.push(productId);
        
        // Request verification
        const productValue = ethers.parseEther("25");
        const fee = await verificationManager.calculateVerificationFee(productValue);
        await authToken.connect(consumer).approve(verificationManager.target, fee);
        
        const verificationTx = await verificationManager.connect(consumer).requestVerification(productId, productValue);
        const verificationReceipt = await verificationTx.wait();
        const verificationEvent = verificationReceipt.logs.find(log => {
          try {
            return verificationManager.interface.parseLog(log).name === "VerificationRequested";
          } catch {
            return false;
          }
        });
        const requestId = verificationManager.interface.parseLog(verificationEvent).args[0];
        requests.push(requestId);
      }
      
      // Assign and complete verifications with different results
      // Verifier1: 2 successful, 1 failed
      // Verifier2: 1 successful (we'll only do 1 for verifier2)
      
      await verificationManager.assignVerifier(requests[0], verifier.address);
      await verificationManager.connect(verifier).completeVerification(requests[0], true, "evidence1");
      
      await verificationManager.assignVerifier(requests[1], verifier.address);
      await verificationManager.connect(verifier).completeVerification(requests[1], false, "evidence2");
      
      await verificationManager.assignVerifier(requests[2], verifier2.address);
      await verificationManager.connect(verifier2).completeVerification(requests[2], true, "evidence3");
      
      // Check verifier statistics
      const verifier1Stats = await verificationManager.verifiers(verifier.address);
      expect(verifier1Stats.totalVerifications).to.equal(2);
      expect(verifier1Stats.successfulVerifications).to.equal(1);
      
      const verifier2Stats = await verificationManager.verifiers(verifier2.address);
      expect(verifier2Stats.totalVerifications).to.equal(1);
      expect(verifier2Stats.successfulVerifications).to.equal(1);
      
      // Check fee distribution
      const verifier1Rewards = await feeDistributor.verifierInfo(verifier.address);
      const verifier2Rewards = await feeDistributor.verifierInfo(verifier2.address);
      
      expect(verifier1Rewards.pending).to.be.gt(0);
      expect(verifier2Rewards.pending).to.be.gt(0);
      
      // Claim rewards
      const initialBalance1 = await authToken.balanceOf(verifier.address);
      await feeDistributor.connect(verifier).claimRewards();
      const finalBalance1 = await authToken.balanceOf(verifier.address);
      expect(finalBalance1).to.be.gt(initialBalance1);
    });
  });

  describe("Fraud Detection and Dispute Resolution", function () {
    it("Should handle timeout and slashing scenarios", async function () {
      // Register product and verifier
      const productTx = await productRegistry.connect(manufacturer).registerProduct("ipfs://QmTest");
      const productReceipt = await productTx.wait();
      const productEvent = productReceipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      const productId = productRegistry.interface.parseLog(productEvent).args[0];
      
      const stakeAmount = ethers.parseEther("1000");
      await authToken.connect(verifier).approve(verificationManager.target, stakeAmount);
      await verificationManager.connect(verifier).registerVerifier(stakeAmount);
      
      // Request verification
      const productValue = ethers.parseEther("40");
      const fee = await verificationManager.calculateVerificationFee(productValue);
      await authToken.connect(consumer).approve(verificationManager.target, fee);
      
      const verificationTx = await verificationManager.connect(consumer).requestVerification(productId, productValue);
      const verificationReceipt = await verificationTx.wait();
      const verificationEvent = verificationReceipt.logs.find(log => {
        try {
          return verificationManager.interface.parseLog(log).name === "VerificationRequested";
        } catch {
          return false;
        }
      });
      const requestId = verificationManager.interface.parseLog(verificationEvent).args[0];
      
      // Assign verifier but let it timeout
      await verificationManager.assignVerifier(requestId, verifier.address);
      
      const initialStake = (await verificationManager.verifiers(verifier.address)).stakedAmount;
      
      // Fast forward past timeout
      await time.increase(4 * 24 * 60 * 60); // 4 days
      
      // Handle timeout (should slash verifier)
      await expect(verificationManager.handleTimeout(requestId))
        .to.emit(verificationManager, "VerifierSlashed");
      
      const finalStake = (await verificationManager.verifiers(verifier.address)).stakedAmount;
      expect(finalStake).to.be.lt(initialStake);
    });

    it("Should handle disputed products", async function () {
      // Register and transfer product
      const productTx = await productRegistry.connect(manufacturer).registerProduct("ipfs://QmDisputed");
      const productReceipt = await productTx.wait();
      const productEvent = productReceipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      const productId = productRegistry.interface.parseLog(productEvent).args[0];
      
      // Transfer to retailer
      await productRegistry.connect(manufacturer).transferProduct(
        productId,
        retailer.address,
        "Retail Store",
        ethers.keccak256(ethers.toUtf8Bytes("transfer"))
      );
      
      // Mark as disputed (can be done from any state)
      await productRegistry.connect(manufacturer).updateStatus(productId, 4); // Disputed
      
      const product = await productRegistry.products(productId);
      expect(product.status).to.equal(4); // Disputed
      
      // Disputed products should still be queryable
      expect(await productRegistry.isRegistered(productId)).to.be.true;
      
      // History should be preserved
      const history = await productRegistry.getProductHistory(productId);
      expect(history.length).to.equal(2); // Registration + Transfer
    });
  });

  describe("Governance and Admin Functions", function () {
    it("Should allow parameter updates across all contracts", async function () {
      // Update AuthToken parameters
      await authToken.setRewardRate(12); // 12% APY
      expect(await authToken.rewardRate()).to.equal(12);
      
      // Update VerificationManager parameters
      await verificationManager.setVerificationFees(
        ethers.parseEther("0.05"),
        ethers.parseEther("0.5")
      );
      expect(await verificationManager.minVerificationFee()).to.equal(ethers.parseEther("0.05"));
      
      // Update FeeDistributor shares
      await feeDistributor.setDistributionShares(5000, 3000, 2000); // 50%, 30%, 20%
      expect(await feeDistributor.verifierShare()).to.equal(5000);
      
      // Update Oracle parameters
      await oracleIntegration.setAggregationParams(150, 7000); // Lower quorum, higher pass threshold
      expect(await oracleIntegration.quorumWeight()).to.equal(150);
      expect(await oracleIntegration.passBpsThreshold()).to.equal(7000);
    });

    it("Should handle emergency pause across all contracts", async function () {
      // Pause all contracts
      await authToken.pause();
      await productRegistry.pause();
      await verificationManager.pause();
      await oracleIntegration.pause();
      await feeDistributor.pause();
      
      // Verify all are paused
      expect(await authToken.paused()).to.be.true;
      expect(await productRegistry.paused()).to.be.true;
      expect(await verificationManager.paused()).to.be.true;
      expect(await oracleIntegration.paused()).to.be.true;
      expect(await feeDistributor.paused()).to.be.true;
      
      // Operations should be blocked
      await expect(productRegistry.connect(manufacturer).registerProduct("test"))
        .to.be.revertedWithCustomError(productRegistry, "EnforcedPause");
      
      // Unpause and verify operations work again
      await authToken.unpause();
      await productRegistry.unpause();
      await verificationManager.unpause();
      await oracleIntegration.unpause();
      await feeDistributor.unpause();
      
      // Should work again
      await expect(productRegistry.connect(manufacturer).registerProduct("test"))
        .to.emit(productRegistry, "ProductRegistered");
    });
  });

  describe("Performance and Gas Optimization", function () {
    it("Should handle batch operations efficiently", async function () {
      const batchSize = 5;
      const products = [];
      
      // Batch register products
      for (let i = 0; i < batchSize; i++) {
        const tx = await productRegistry.connect(manufacturer).registerProduct(`ipfs://QmBatch${i}`);
        const receipt = await tx.wait();
        
        const event = receipt.logs.find(log => {
          try {
            return productRegistry.interface.parseLog(log).name === "ProductRegistered";
          } catch {
            return false;
          }
        });
        const productId = productRegistry.interface.parseLog(event).args[0];
        products.push(productId);
        
        // Verify gas usage is reasonable (this is more of a manual check)
        expect(receipt.gasUsed).to.be.lt(500000); // Should be less than 500k gas per registration
      }
      
      // Verify all products are registered
      for (const productId of products) {
        expect(await productRegistry.isRegistered(productId)).to.be.true;
      }
    });
  });
});
