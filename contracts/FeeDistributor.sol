// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AuthToken.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FeeDistributor is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    struct RevenueShareBps {
        uint16 verifier; // e.g. 8000 = 80.00%
        uint16 brand;    // e.g. 1000 = 10.00%
        uint16 treasury; // e.g. 1000 = 10.00%
    }

    struct StakeholderInfo {
        uint256 pending;
        uint256 claimed;
    }

    AuthToken public immutable authToken;
    address public immutable treasury;

    RevenueShareBps public shares = RevenueShareBps(8000, 1000, 1000); // default 80/10/10
    uint256 public totalDistributed;

    mapping(address => StakeholderInfo) public verifierInfo;
    mapping(address => StakeholderInfo) public brandInfo;

    event RevenueDistributed(address indexed verifier, address indexed brand, uint256 totalFee);
    event RewardsClaimed(address indexed stakeholder, uint256 amount);
    event SharesUpdated(uint16 verifier, uint16 brand, uint16 treasury);
    event Paused(address account);
    event Unpaused(address account);

    constructor(address _authToken, address _treasury, address admin) {
        require(_authToken != address(0) && _treasury != address(0), "Zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DISTRIBUTOR_ROLE, admin);
        authToken = AuthToken(_authToken);
        treasury = _treasury;
    }

    /// @notice Called by VerificationManager or admin when a verification fee is collected.
    /// @dev Fee must already have been transferred into this contract before calling.
    function distributeRevenue(
        address verifier,
        address brand,
        uint256 totalFee
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant whenNotPaused {
        require(totalFee > 0, "Invalid fee");
        require(verifier != address(0) && brand != address(0), "Zero addr");

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

    /// @notice Allows verifiers or brands to withdraw their pending rewards.
    function claimRewards() external nonReentrant whenNotPaused {
        uint256 pendingVerifier = verifierInfo[msg.sender].pending;
        uint256 pendingBrand = brandInfo[msg.sender].pending;
        uint256 totalReward = pendingVerifier + pendingBrand;
        require(totalReward > 0, "Nothing to claim");

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

    /// @notice Update revenue sharing ratios (sum must equal 10000 bps).
    function updateShares(uint16 _verifier, uint16 _brand, uint16 _treasury)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(uint256(_verifier) + _brand + _treasury == 10_000, "Sum != 100%");
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

    function pendingRewards(address stakeholder) external view returns (uint256) {
        return verifierInfo[stakeholder].pending + brandInfo[stakeholder].pending;
    }

    function claimedRewards(address stakeholder) external view returns (uint256) {
        return verifierInfo[stakeholder].claimed + brandInfo[stakeholder].claimed;
    }
}
