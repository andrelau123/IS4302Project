// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AuthToken.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FeeDistributor is AccessControl, ReentrancyGuard {
    AuthToken public authToken;

    struct RevenueShare {
        uint256 verifierShare; // 80%
        uint256 brandShare; // 10%
        uint256 treasuryShare; // 10%
    }

    struct Stakeholder {
        address stakeholderAddress;
        uint256 pendingRewards;
        uint256 totalClaimed;
    }

    mapping(address => Stakeholder) public verifiers;
    mapping(address => Stakeholder) public brands;

    address public treasury;
    uint256 public totalDistributed;

    RevenueShare public revenueShare =
        RevenueShare({verifierShare: 80, brandShare: 10, treasuryShare: 10});

    event RevenueDistributed(
        address indexed verifier,
        address indexed brand,
        uint256 amount
    );
    event RewardsClaimed(address indexed stakeholder, uint256 amount);
    event RevenueShareUpdated(
        uint256 verifierShare,
        uint256 brandShare,
        uint256 treasuryShare
    );

    constructor(address _authToken, address _treasury) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        authToken = AuthToken(_authToken);
        treasury = _treasury;
    }

    // Called by VerificationManager when fee is collected
    function distributeRevenue(
        address verifier,
        address brand,
        uint256 totalFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(totalFee > 0, "Invalid fee amount");

        // Calculate shares
        uint256 verifierAmount = (totalFee * revenueShare.verifierShare) / 100;
        uint256 brandAmount = (totalFee * revenueShare.brandShare) / 100;
        uint256 treasuryAmount = (totalFee * revenueShare.treasuryShare) / 100;

        // Update pending rewards
        verifiers[verifier].pendingRewards += verifierAmount;
        brands[brand].pendingRewards += brandAmount;

        // Send treasury share immediately
        authToken.transfer(treasury, treasuryAmount);

        totalDistributed += totalFee;

        emit RevenueDistributed(verifier, brand, totalFee);
    }

    // Verifiers/brands claim their rewards
    function claimRewards() external nonReentrant {
        uint256 rewards = verifiers[msg.sender].pendingRewards +
            brands[msg.sender].pendingRewards;
        require(rewards > 0, "No rewards to claim");

        if (verifiers[msg.sender].pendingRewards > 0) {
            verifiers[msg.sender].totalClaimed += verifiers[msg.sender]
                .pendingRewards;
            verifiers[msg.sender].pendingRewards = 0;
        }

        if (brands[msg.sender].pendingRewards > 0) {
            brands[msg.sender].totalClaimed += brands[msg.sender]
                .pendingRewards;
            brands[msg.sender].pendingRewards = 0;
        }

        authToken.transfer(msg.sender, rewards);

        emit RewardsClaimed(msg.sender, rewards);
    }

    // Update revenue sharing percentages
    function updateRevenueShare(
        uint256 _verifierShare,
        uint256 _brandShare,
        uint256 _treasuryShare
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _verifierShare + _brandShare + _treasuryShare == 100,
            "Must sum to 100"
        );

        revenueShare = RevenueShare({
            verifierShare: _verifierShare,
            brandShare: _brandShare,
            treasuryShare: _treasuryShare
        });

        emit RevenueShareUpdated(_verifierShare, _brandShare, _treasuryShare);
    }

    function getPendingRewards(
        address stakeholder
    ) external view returns (uint256) {
        return
            verifiers[stakeholder].pendingRewards +
            brands[stakeholder].pendingRewards;
    }
}
