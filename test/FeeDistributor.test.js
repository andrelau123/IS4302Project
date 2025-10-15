const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FeeDistributor", function () {
  let feeDistributor;
  let authToken;
  let owner, treasury, verifier1, verifier2, brand1, brand2;
  let DISTRIBUTOR_ROLE;

  beforeEach(async function () {
    [owner, treasury, verifier1, verifier2, brand1, brand2] = await ethers.getSigners();
    
    // Deploy AuthToken
    const AuthToken = await ethers.getContractFactory("AuthToken");
    authToken = await AuthToken.deploy();
    
    // Deploy FeeDistributor
    const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
    feeDistributor = await FeeDistributor.deploy(authToken.target, treasury.address, owner.address);
    
    DISTRIBUTOR_ROLE = await feeDistributor.DISTRIBUTOR_ROLE();
    
    // Transfer tokens to test accounts
    const amount = ethers.parseEther("10000");
    await authToken.transfer(verifier1.address, amount);
    await authToken.transfer(verifier2.address, amount);
    await authToken.transfer(brand1.address, amount);
    await authToken.transfer(brand2.address, amount);
  });

  describe("Deployment", function () {
    it("Should set the correct initial parameters", async function () {
      expect(await feeDistributor.authToken()).to.equal(authToken.target);
      expect(await feeDistributor.treasury()).to.equal(treasury.address);
    });

    it("Should set default distribution shares", async function () {
      expect(await feeDistributor.verifierShare()).to.equal(4000); // 40%
      expect(await feeDistributor.brandShare()).to.equal(4000);    // 40%
      expect(await feeDistributor.treasuryShare()).to.equal(2000); // 20%
    });

    it("Should grant admin and distributor roles correctly", async function () {
      expect(await feeDistributor.hasRole(await feeDistributor.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await feeDistributor.hasRole(DISTRIBUTOR_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Share Management", function () {
    it("Should allow admin to update distribution shares", async function () {
      const newVerifierShare = 5000; // 50%
      const newBrandShare = 3000;    // 30%
      const newTreasuryShare = 2000; // 20%
      
      await expect(feeDistributor.setDistributionShares(newVerifierShare, newBrandShare, newTreasuryShare))
        .to.emit(feeDistributor, "SharesUpdated")
        .withArgs(newVerifierShare, newBrandShare, newTreasuryShare);
      
      expect(await feeDistributor.verifierShare()).to.equal(newVerifierShare);
      expect(await feeDistributor.brandShare()).to.equal(newBrandShare);
      expect(await feeDistributor.treasuryShare()).to.equal(newTreasuryShare);
    });

    it("Should not allow shares that don't sum to 10000", async function () {
      await expect(feeDistributor.setDistributionShares(4000, 4000, 1000)) // Only 90%
        .to.be.revertedWith("Shares must sum to 10000");
      
      await expect(feeDistributor.setDistributionShares(5000, 5000, 1000)) // 110%
        .to.be.revertedWith("Shares must sum to 10000");
    });

    it("Should not allow non-admin to update shares", async function () {
      await expect(feeDistributor.connect(verifier1).setDistributionShares(5000, 3000, 2000))
        .to.be.reverted;
    });
  });

  describe("Revenue Distribution", function () {
    beforeEach(async function () {
      // Grant distributor role to test the distribution functionality
      await feeDistributor.grantRole(DISTRIBUTOR_ROLE, owner.address);
    });

    it("Should distribute revenue correctly with default shares", async function () {
      const totalFee = ethers.parseEther("100");
      
      // Approve distributor to transfer fee from caller
      await authToken.approve(feeDistributor.target, totalFee);
      
      await expect(feeDistributor.distributeRevenue(verifier1.address, brand1.address, totalFee))
        .to.emit(feeDistributor, "RevenueDistributed")
        .withArgs(verifier1.address, brand1.address, totalFee);
      
      // Check verifier info (40% = 40 ETH)
      const verifierInfo = await feeDistributor.verifierInfo(verifier1.address);
      expect(verifierInfo.pending).to.equal(ethers.parseEther("40"));
      expect(verifierInfo.claimed).to.equal(ethers.parseEther("0"));
      
      // Check brand info (40% = 40 ETH)
      const brandInfo = await feeDistributor.brandInfo(brand1.address);
      expect(brandInfo.pending).to.equal(ethers.parseEther("40"));
      expect(brandInfo.claimed).to.equal(ethers.parseEther("0"));
      
      // Check treasury balance (20% = 20 ETH)
      const treasuryBalance = await authToken.balanceOf(treasury.address);
      expect(treasuryBalance).to.equal(ethers.parseEther("20"));
    });

    it("Should accumulate rewards for multiple distributions", async function () {
      const fee1 = ethers.parseEther("100");
      const fee2 = ethers.parseEther("50");
      
      // Approve total amount for both distributions
      await authToken.approve(feeDistributor.target, fee1 + fee2);
      
      // First distribution
      await feeDistributor.distributeRevenue(verifier1.address, brand1.address, fee1);
      
      // Second distribution
      await feeDistributor.distributeRevenue(verifier1.address, brand1.address, fee2);
      
      const verifierInfo = await feeDistributor.verifierInfo(verifier1.address);
      expect(verifierInfo.pending).to.equal(ethers.parseEther("60")); // 40 + 20
      expect(verifierInfo.claimed).to.equal(ethers.parseEther("0"));
    });

    it("Should handle distributions to different stakeholders", async function () {
      const totalFee = ethers.parseEther("100");
      await authToken.approve(feeDistributor.target, totalFee);
      
      await feeDistributor.distributeRevenue(verifier1.address, brand1.address, ethers.parseEther("60"));
      await feeDistributor.distributeRevenue(verifier2.address, brand2.address, ethers.parseEther("40"));
      
      // Check first verifier
      const verifier1Info = await feeDistributor.verifierInfo(verifier1.address);
      expect(verifier1Info.pending).to.equal(ethers.parseEther("24")); // 40% of 60
      
      // Check second verifier
      const verifier2Info = await feeDistributor.verifierInfo(verifier2.address);
      expect(verifier2Info.pending).to.equal(ethers.parseEther("16")); // 40% of 40
      
      // Check first brand
      const brand1Info = await feeDistributor.brandInfo(brand1.address);
      expect(brand1Info.pending).to.equal(ethers.parseEther("24"));
      
      // Check second brand
      const brand2Info = await feeDistributor.brandInfo(brand2.address);
      expect(brand2Info.pending).to.equal(ethers.parseEther("16"));
    });

    it("Should not allow non-distributor to distribute revenue", async function () {
      const totalFee = ethers.parseEther("100");
      
      await expect(feeDistributor.connect(verifier1).distributeRevenue(verifier1.address, brand1.address, totalFee))
        .to.be.reverted;
    });
  });

  describe("Reward Claiming", function () {
    beforeEach(async function () {
      await feeDistributor.grantRole(DISTRIBUTOR_ROLE, owner.address);
      
      // Setup initial distribution
      const totalFee = ethers.parseEther("100");
      await authToken.approve(feeDistributor.target, totalFee);
      await feeDistributor.distributeRevenue(verifier1.address, brand1.address, totalFee);
    });

    it("Should allow verifiers to claim rewards", async function () {
      const initialBalance = await authToken.balanceOf(verifier1.address);
      const pendingRewards = ethers.parseEther("40");
      
      await expect(feeDistributor.connect(verifier1).claimRewards())
        .to.emit(feeDistributor, "RewardsClaimed")
        .withArgs(verifier1.address, pendingRewards);
      
      const finalBalance = await authToken.balanceOf(verifier1.address);
      expect(finalBalance - initialBalance).to.equal(pendingRewards);
      
      // Check that pending rewards are reset
      const verifierInfo = await feeDistributor.verifierInfo(verifier1.address);
      expect(verifierInfo.pending).to.equal(0);
      expect(verifierInfo.claimed).to.equal(pendingRewards); // Total earned should remain
    });

    it("Should allow brands to claim rewards", async function () {
      const initialBalance = await authToken.balanceOf(brand1.address);
      const pendingRewards = ethers.parseEther("40");
      
      await expect(feeDistributor.connect(brand1).claimRewards())
        .to.emit(feeDistributor, "RewardsClaimed")
        .withArgs(brand1.address, pendingRewards);
      
      const finalBalance = await authToken.balanceOf(brand1.address);
      expect(finalBalance - initialBalance).to.equal(pendingRewards);
      
      const brandInfo = await feeDistributor.brandInfo(brand1.address);
      expect(brandInfo.pending).to.equal(0);
    });

    it("Should not allow claiming when no rewards pending", async function () {
      // User with no rewards tries to claim
      await expect(feeDistributor.connect(verifier2).claimRewards())
        .to.be.revertedWith("No rewards");
      
      // User who already claimed tries again
      await feeDistributor.connect(verifier1).claimRewards();
      await expect(feeDistributor.connect(verifier1).claimRewards())
        .to.be.revertedWith("No rewards");
    });

    it("Should handle multiple claim cycles correctly", async function () {
      // First claim
      await feeDistributor.connect(verifier1).claimRewards();
      
      // New distribution
      const newFee = ethers.parseEther("50");
      await authToken.approve(feeDistributor.target, newFee);
      await feeDistributor.distributeRevenue(verifier1.address, brand1.address, newFee);
      
      // Second claim
      const initialBalance = await authToken.balanceOf(verifier1.address);
      await feeDistributor.connect(verifier1).claimRewards();
      const finalBalance = await authToken.balanceOf(verifier1.address);
      
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("20")); // 40% of 50
      
      // Check total earned is cumulative
      const verifierInfo = await feeDistributor.verifierInfo(verifier1.address);
      expect(verifierInfo.claimed).to.equal(ethers.parseEther("60")); // 40 + 20
    });
  });

  describe("Pausable Functionality", function () {
    beforeEach(async function () {
      await feeDistributor.grantRole(DISTRIBUTOR_ROLE, owner.address);
      
      // Setup initial distribution
      const totalFee = ethers.parseEther("100");
      await authToken.approve(feeDistributor.target, totalFee);
      await feeDistributor.distributeRevenue(verifier1.address, brand1.address, totalFee);
    });

    it("Should prevent operations when paused", async function () {
      await feeDistributor.pause();
      
      // Should prevent revenue distribution
      await expect(feeDistributor.distributeRevenue(verifier2.address, brand2.address, ethers.parseEther("50")))
        .to.be.revertedWithCustomError(feeDistributor, "EnforcedPause");
      
      // Should prevent reward claiming
      await expect(feeDistributor.connect(verifier1).claimRewards())
        .to.be.revertedWithCustomError(feeDistributor, "EnforcedPause");
    });

    it("Should allow admin to pause and unpause", async function () {
      await feeDistributor.pause();
      expect(await feeDistributor.paused()).to.be.true;
      
      await feeDistributor.unpause();
      expect(await feeDistributor.paused()).to.be.false;
      
      // Operations should work after unpausing
      await expect(feeDistributor.connect(verifier1).claimRewards())
        .to.emit(feeDistributor, "RewardsClaimed");
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(feeDistributor.connect(verifier1).pause())
        .to.be.reverted;
    });
  });

  describe("Query Functions", function () {
    beforeEach(async function () {
      await feeDistributor.grantRole(DISTRIBUTOR_ROLE, owner.address);
    });

    it("Should return correct pending rewards", async function () {
      const totalFee = ethers.parseEther("100");
      await authToken.approve(feeDistributor.target, totalFee);
      await feeDistributor.distributeRevenue(verifier1.address, brand1.address, totalFee);
      
      expect(await feeDistributor.getPendingRewards(verifier1.address)).to.equal(ethers.parseEther("40"));
      expect(await feeDistributor.getPendingRewards(brand1.address)).to.equal(ethers.parseEther("40"));
      expect(await feeDistributor.getPendingRewards(verifier2.address)).to.equal(0);
    });

    it("Should return correct total earnings", async function () {
      const totalFee = ethers.parseEther("100");
      await authToken.approve(feeDistributor.target, totalFee);
      await feeDistributor.distributeRevenue(verifier1.address, brand1.address, totalFee);
      
      // Before claiming, total earnings should be 0
      expect(await feeDistributor.getTotalEarnings(verifier1.address)).to.equal(0);
      
      // After claiming, total earnings should be 40 ETH
      await feeDistributor.connect(verifier1).claimRewards();
      expect(await feeDistributor.getTotalEarnings(verifier1.address)).to.equal(ethers.parseEther("40"));
    });
  });

  describe("Edge Cases", function () {
    beforeEach(async function () {
      await feeDistributor.grantRole(DISTRIBUTOR_ROLE, owner.address);
    });

    it("Should handle zero fee distribution", async function () {
      await expect(feeDistributor.distributeRevenue(verifier1.address, brand1.address, 0))
        .to.be.revertedWith("Fee must be > 0");
    });

    it("Should handle distribution with insufficient contract balance", async function () {
      const largeFee = ethers.parseEther("1000");
      // Contract doesn't have enough tokens
      
      await expect(feeDistributor.distributeRevenue(verifier1.address, brand1.address, largeFee))
        .to.be.reverted; // Should fail on token transfer
    });

    it("Should handle zero address parameters correctly", async function () {
      const totalFee = ethers.parseEther("100");
      await authToken.transfer(feeDistributor.target, totalFee);
      
      await expect(feeDistributor.distributeRevenue(ethers.ZeroAddress, brand1.address, totalFee))
        .to.be.revertedWith("Invalid verifier");
      
      await expect(feeDistributor.distributeRevenue(verifier1.address, ethers.ZeroAddress, totalFee))
        .to.be.revertedWith("Invalid brand");
    });
  });
});
