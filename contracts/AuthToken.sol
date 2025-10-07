// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AuthToken is ERC20, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion tokens
    uint256 public totalStaked;

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 rewardDebt;
    }

    mapping(address => StakeInfo) public stakes;
    uint256 public rewardRate = 8; // 8% APY
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);

    constructor() ERC20("Auth Token", "AUTH") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        // Initial distribution
        _mint(msg.sender, (MAX_SUPPLY * 40) / 100); // 40% manufacturers
        _mint(address(this), (MAX_SUPPLY * 30) / 100); // 30% rewards pool
        _mint(msg.sender, (MAX_SUPPLY * 20) / 100); // 20% ecosystem
        _mint(msg.sender, (MAX_SUPPLY * 10) / 100); // 10% team
    }

    function stake(uint256 amount) external whenNotPaused {
        require(amount > 0, "Cannot stake 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Claim existing rewards first
        if (stakes[msg.sender].amount > 0) {
            _claimRewards(msg.sender);
        }

        _transfer(msg.sender, address(this), amount);

        stakes[msg.sender].amount += amount;
        stakes[msg.sender].stakedAt = block.timestamp;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot unstake 0");
        require(
            stakes[msg.sender].amount >= amount,
            "Insufficient staked amount"
        );

        uint256 reward = calculateReward(msg.sender);

        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;

        _transfer(address(this), msg.sender, amount);
        if (reward > 0) {
            _transfer(address(this), msg.sender, reward);
        }

        stakes[msg.sender].stakedAt = block.timestamp;
        stakes[msg.sender].rewardDebt = 0;

        emit Unstaked(msg.sender, amount, reward);
    }

    function calculateReward(address user) public view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        if (userStake.amount == 0) return 0;

        uint256 stakingDuration = block.timestamp - userStake.stakedAt;
        uint256 reward = (userStake.amount * rewardRate * stakingDuration) /
            (100 * SECONDS_PER_YEAR);

        return reward;
    }

    function _claimRewards(address user) internal {
        uint256 reward = calculateReward(user);
        if (reward > 0) {
            _transfer(address(this), user, reward);
            stakes[user].stakedAt = block.timestamp;
        }
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
