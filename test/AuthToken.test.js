const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AuthToken", function () {
  let authToken;
  let owner, user1, user2, minter;
  let MINTER_ROLE, DEFAULT_ADMIN_ROLE;

  beforeEach(async function () {
    [owner, user1, user2, minter] = await ethers.getSigners();
    
    const AuthToken = await ethers.getContractFactory("AuthToken");
    authToken = await AuthToken.deploy();
    
    MINTER_ROLE = await authToken.MINTER_ROLE();
    DEFAULT_ADMIN_ROLE = await authToken.DEFAULT_ADMIN_ROLE();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await authToken.name()).to.equal("Auth Token");
      expect(await authToken.symbol()).to.equal("AUTH");
    });

    it("Should have correct initial supply distribution", async function () {
      const maxSupply = await authToken.MAX_SUPPLY();
      const ownerBalance = await authToken.balanceOf(owner.address);
      const contractBalance = await authToken.balanceOf(authToken.target);
      
      // Owner gets 40% + 20% + 10% = 70%
      const expectedOwnerBalance = (maxSupply * 70n) / 100n;
      expect(ownerBalance).to.equal(expectedOwnerBalance);
      
      // Contract gets 30% for rewards pool
      const expectedContractBalance = (maxSupply * 30n) / 100n;
      expect(contractBalance).to.equal(expectedContractBalance);
    });

    it("Should grant admin and minter roles to deployer", async function () {
      expect(await authToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await authToken.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });

    it("Should set correct initial parameters", async function () {
      expect(await authToken.rewardRate()).to.equal(8);
      expect(await authToken.lockPeriod()).to.equal(7 * 24 * 60 * 60); // 7 days
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to grant minter role", async function () {
      await authToken.grantRole(MINTER_ROLE, minter.address);
      expect(await authToken.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("Should not allow non-admin to grant roles", async function () {
      await expect(
        authToken.connect(user1).grantRole(MINTER_ROLE, user2.address)
      ).to.be.reverted;
    });

    it("Should allow admin to pause/unpause", async function () {
      await authToken.pause();
      expect(await authToken.paused()).to.be.true;
      
      await authToken.unpause();
      expect(await authToken.paused()).to.be.false;
    });
  });

  describe("Staking", function () {
    beforeEach(async function () {
      // Transfer some tokens to users for testing
      const amount = ethers.parseEther("1000");
      await authToken.transfer(user1.address, amount);
      await authToken.transfer(user2.address, amount);
    });

    it("Should allow users to stake tokens", async function () {
      const stakeAmount = ethers.parseEther("100");
      await authToken.connect(user1).approve(authToken.target, stakeAmount);
      
      const tx = await authToken.connect(user1).stake(stakeAmount);
      const receipt = await tx.wait();
      const blockTimestamp = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;
      const expectedUnlockTime = blockTimestamp + 7 * 24 * 60 * 60;
      
      await expect(tx)
        .to.emit(authToken, "Staked")
        .withArgs(user1.address, stakeAmount, expectedUnlockTime);
      
      const stakeInfo = await authToken.stakes(user1.address);
      expect(stakeInfo.amount).to.equal(stakeAmount);
      expect(await authToken.totalStaked()).to.equal(stakeAmount);
    });

    it("Should not allow staking zero amount", async function () {
      await expect(authToken.connect(user1).stake(0))
        .to.be.revertedWith("Amount=0");
    });

    it("Should not allow staking without sufficient balance", async function () {
      const stakeAmount = ethers.parseEther("2000"); // More than user has
      await authToken.connect(user1).approve(authToken.target, stakeAmount);
      
      await expect(authToken.connect(user1).stake(stakeAmount))
        .to.be.reverted;
    });

    it("Should calculate rewards correctly", async function () {
      const stakeAmount = ethers.parseEther("100");
      await authToken.connect(user1).approve(authToken.target, stakeAmount);
      await authToken.connect(user1).stake(stakeAmount);
      
      // Advance time by 1 year
      await time.increase(365 * 24 * 60 * 60);
      
      const pendingReward = await authToken.pendingReward(user1.address);
      // Should be approximately 8% of staked amount (8 AUTH for 100 staked)
      const expectedReward = ethers.parseEther("8");
      expect(pendingReward).to.be.closeTo(expectedReward, ethers.parseEther("0.1"));
    });

    it("Should allow claiming rewards", async function () {
      const stakeAmount = ethers.parseEther("100");
      await authToken.connect(user1).approve(authToken.target, stakeAmount);
      await authToken.connect(user1).stake(stakeAmount);
      
      // Advance time by 6 months
      await time.increase(182 * 24 * 60 * 60);
      
      const initialBalance = await authToken.balanceOf(user1.address);
      await expect(authToken.connect(user1).claimRewards())
        .to.emit(authToken, "RewardClaimed");
      
      const finalBalance = await authToken.balanceOf(user1.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should not allow unstaking before lock period", async function () {
      const stakeAmount = ethers.parseEther("100");
      await authToken.connect(user1).approve(authToken.target, stakeAmount);
      await authToken.connect(user1).stake(stakeAmount);
      
      await expect(authToken.connect(user1).unstake())
        .to.be.revertedWith("Still locked");
    });

    it("Should allow unstaking after lock period", async function () {
      const stakeAmount = ethers.parseEther("100");
      await authToken.connect(user1).approve(authToken.target, stakeAmount);
      await authToken.connect(user1).stake(stakeAmount);
      
      // Advance time beyond lock period
      await time.increase(8 * 24 * 60 * 60); // 8 days
      
      const initialBalance = await authToken.balanceOf(user1.address);
      await expect(authToken.connect(user1).unstake())
        .to.emit(authToken, "Unstaked");
      
      const finalBalance = await authToken.balanceOf(user1.address);
      expect(finalBalance).to.be.gte(initialBalance + stakeAmount);
      
      const stakeInfo = await authToken.stakes(user1.address);
      expect(stakeInfo.amount).to.equal(0);
    });
  });

  describe("Governance Functions", function () {
    it("Should allow admin to update reward rate", async function () {
      const newRate = 10;
      await expect(authToken.setRewardRate(newRate))
        .to.emit(authToken, "RewardRateUpdated")
        .withArgs(newRate);
      
      expect(await authToken.rewardRate()).to.equal(newRate);
    });

    it("Should not allow setting reward rate above maximum", async function () {
      const maxRate = await authToken.MAX_APY_PERCENT();
      await expect(authToken.setRewardRate(maxRate + 1n))
        .to.be.revertedWith("Rate too high");
    });

    it("Should allow admin to update lock period", async function () {
      const newPeriod = 14 * 24 * 60 * 60; // 14 days
      await expect(authToken.setLockPeriod(newPeriod))
        .to.emit(authToken, "LockPeriodUpdated")
        .withArgs(newPeriod);
      
      expect(await authToken.lockPeriod()).to.equal(newPeriod);
    });

    it("Should allow admin to top up rewards", async function () {
      const topUpAmount = ethers.parseEther("1000");
      await expect(authToken.topUpRewards(topUpAmount))
        .to.emit(authToken, "RewardsToppedUp")
        .withArgs(topUpAmount);
    });

    it("Should not allow non-admin to change parameters", async function () {
      await expect(authToken.connect(user1).setRewardRate(10))
        .to.be.reverted;
      
      await expect(authToken.connect(user1).setLockPeriod(14 * 24 * 60 * 60))
        .to.be.reverted;
    });
  });

  describe("Pausable", function () {
    it("Should prevent staking when paused", async function () {
      const stakeAmount = ethers.parseEther("100");
      await authToken.transfer(user1.address, stakeAmount);
      await authToken.connect(user1).approve(authToken.target, stakeAmount);
      
      await authToken.pause();
      
      await expect(authToken.connect(user1).stake(stakeAmount))
        .to.be.revertedWithCustomError(authToken, "EnforcedPause");
    });

    it("Should prevent transfers when paused", async function () {
      await authToken.pause();
      
      await expect(authToken.transfer(user1.address, ethers.parseEther("100")))
        .to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Supply Cap", function () {
    it("Should respect max supply cap during deployment", async function () {
      // Verify that total supply equals max supply (constructor mints 100%)
      const maxSupply = await authToken.MAX_SUPPLY();
      const totalSupply = await authToken.totalSupply();
      expect(totalSupply).to.equal(maxSupply);
      
      // Verify that topUpRewards cannot exceed balance (since it transfers, not mints)
      const excessAmount = ethers.parseEther("1000000000000"); // Much more than anyone has
      await expect(authToken.topUpRewards(excessAmount))
        .to.be.revertedWith("AUTH: insufficient balance");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple stakes from same user", async function () {
      const stakeAmount1 = ethers.parseEther("50");
      const stakeAmount2 = ethers.parseEther("30");
      
      await authToken.transfer(user1.address, ethers.parseEther("200"));
      await authToken.connect(user1).approve(authToken.target, ethers.parseEther("200"));
      
      await authToken.connect(user1).stake(stakeAmount1);
      
      // Advance time partially through lock period
      await time.increase(3 * 24 * 60 * 60); // 3 days
      
      // Second stake should extend lock period
      await authToken.connect(user1).stake(stakeAmount2);
      
      const stakeInfo = await authToken.stakes(user1.address);
      expect(stakeInfo.amount).to.equal(stakeAmount1 + stakeAmount2);
    });

    it("Should handle rewards calculation correctly for partial year", async function () {
      const stakeAmount = ethers.parseEther("365"); // 1 AUTH per day at 100% APY
      await authToken.transfer(user1.address, stakeAmount);
      await authToken.connect(user1).approve(authToken.target, stakeAmount);
      await authToken.connect(user1).stake(stakeAmount);
      
      // Set reward rate to 20% (maximum allowed)
      await authToken.setRewardRate(20);
      
      // Advance time by exactly 1 day
      await time.increase(24 * 60 * 60);
      
      const pendingReward = await authToken.pendingReward(user1.address);
      const expectedDailyReward = ethers.parseEther("0.2"); // 365 AUTH * 20% APY / 365 days
      expect(pendingReward).to.be.closeTo(expectedDailyReward, ethers.parseEther("0.01"));
    });
  });
});
