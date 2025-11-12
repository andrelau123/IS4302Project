// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AuthToken.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FeeDistributor is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    struct RevenueShareBps {
        uint16 verifier; // e.g.40
        uint16 brand; // e.g. 40
        uint16 treasury; // e.g. 20
    }

    struct StakeholderInfo {
        uint256 pending;
        uint256 claimed;
    }

    AuthToken public immutable authToken;
    address public immutable treasury;

    RevenueShareBps public shares = RevenueShareBps(4000, 4000, 2000); // default 40/40/20
    uint256 public totalDistributed;

    mapping(address => StakeholderInfo) public verifierInfo;
    mapping(address => StakeholderInfo) public brandInfo;

    event RevenueDistributed(
        address indexed verifier,
        address indexed brand,
        uint256 totalFee
    );
    event RewardsClaimed(address indexed stakeholder, uint256 amount);
    event SharesUpdated(uint16 verifier, uint16 brand, uint16 treasury);

    constructor(address _authToken, address _treasury, address admin) {
        require(
            _authToken != address(0) && _treasury != address(0),
            "Zero address"
        );
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DISTRIBUTOR_ROLE, admin);
        authToken = AuthToken(_authToken);
        treasury = _treasury;
    }

    /// Called by VerificationManager or admin when a verification fee is collected.
    /// Fee must already have been transferred into this contract before calling.
    function distributeRevenue(
        address verifier,
        address brand,
        uint256 totalFee
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant whenNotPaused {
        require(totalFee > 0, "Fee must be > 0");
        require(verifier != address(0), "Invalid verifier");
        require(brand != address(0), "Invalid brand");
        require(
            authToken.balanceOf(address(this)) >= totalFee,
            "Insufficient balance"
        );

        uint256 verifierAmt = (totalFee * shares.verifier) / 10_000;
        uint256 brandAmt = (totalFee * shares.brand) / 10_000;
        uint256 treasuryAmt = totalFee - verifierAmt - brandAmt; // ensures rounding consistency

        // Update internal accounting (pull-payment)
        verifierInfo[verifier].pending += verifierAmt;
        brandInfo[brand].pending += brandAmt;

        // Immediate treasury payout
        if (treasuryAmt > 0) {
            authToken.transfer(treasury, treasuryAmt);
        }

        totalDistributed += totalFee;
        emit RevenueDistributed(verifier, brand, totalFee);
    }

    /// Withdraw pending rewards
    function claimRewards() external nonReentrant whenNotPaused {
        uint256 pendingVerifier = verifierInfo[msg.sender].pending;
        uint256 pendingBrand = brandInfo[msg.sender].pending;
        uint256 totalReward = pendingVerifier + pendingBrand;
        require(totalReward > 0, "No rewards");

        // Effects before interactions
        if (pendingVerifier > 0) {
            verifierInfo[msg.sender].claimed += pendingVerifier;
            verifierInfo[msg.sender].pending = 0;
        }
        if (pendingBrand > 0) {
            brandInfo[msg.sender].claimed += pendingBrand;
            brandInfo[msg.sender].pending = 0;
        }

        authToken.transfer(msg.sender, totalReward);
        emit RewardsClaimed(msg.sender, totalReward);
    }

    /// Update revenue sharing ratios (sum must equal 10000 bps).
    function updateShares(
        uint16 _verifier,
        uint16 _brand,
        uint16 _treasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            uint256(_verifier) + _brand + _treasury == 10_000,
            "Shares must sum to 10000"
        );
        shares = RevenueShareBps(_verifier, _brand, _treasury);
        emit SharesUpdated(_verifier, _brand, _treasury);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit Paused(msg.sender);
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit Unpaused(msg.sender);
    }

    function pendingRewards(
        address stakeholder
    ) external view returns (uint256) {
        return
            verifierInfo[stakeholder].pending + brandInfo[stakeholder].pending;
    }

    function claimedRewards(
        address stakeholder
    ) external view returns (uint256) {
        return
            verifierInfo[stakeholder].claimed + brandInfo[stakeholder].claimed;
    }

    /// Get individual share values for testing compatibility
    function verifierShare() external view returns (uint16) {
        return shares.verifier;
    }

    function brandShare() external view returns (uint16) {
        return shares.brand;
    }

    function treasuryShare() external view returns (uint16) {
        return shares.treasury;
    }

    /// Alias for updateShares to match test expectations
    function setDistributionShares(
        uint16 _verifier,
        uint16 _brand,
        uint16 _treasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            uint256(_verifier) + _brand + _treasury == 10_000,
            "Shares must sum to 10000"
        );
        shares = RevenueShareBps(_verifier, _brand, _treasury);
        emit SharesUpdated(_verifier, _brand, _treasury);
    }

    /// Get pending rewards for a stakeholder (alias for pendingRewards)
    function getPendingRewards(
        address stakeholder
    ) external view returns (uint256) {
        return
            verifierInfo[stakeholder].pending + brandInfo[stakeholder].pending;
    }

    /// Get total earnings for a stakeholder (alias for claimedRewards)
    function getTotalEarnings(
        address stakeholder
    ) external view returns (uint256) {
        return
            verifierInfo[stakeholder].claimed + brandInfo[stakeholder].claimed;
    }
}
