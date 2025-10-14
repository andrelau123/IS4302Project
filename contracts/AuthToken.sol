// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AuthToken is ERC20, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1B AUTH
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // Reasonable upper bound for governance-set APY (in %, e.g., 8 = 8%)
    uint256 public constant MAX_APY_PERCENT = 20;
--
    uint256 public totalStaked;
    uint256 private _minted; // track total minted to enforce cap

    struct StakeInfo {
        uint256 amount;    // staked principal
        uint256 stakedAt;  // last reward timestamp (also updated on claim/unstake)
        uint256 unlockAt;  // cannot unstake before this time
    }

    mapping(address => StakeInfo) public stakes;

    /// @dev Annual percentage yield (integer percent). Example: 8 means 8% APY.
    uint256 public rewardRate = 8;

    /// @dev Minimum lock time for any new/updated stake.
    uint256 public lockPeriod = 7 days;

    event Staked(address indexed user, uint256 amount, uint256 unlockAt);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event RewardClaimed(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 newRatePercent);
    event LockPeriodUpdated(uint256 newLockPeriod);
    event RewardsToppedUp(uint256 amountMintedToPool);

    constructor() ERC20("Auth Token", "AUTH") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        // Initial distribution (100% of MAX_SUPPLY)
        _mintCapped(msg.sender, (MAX_SUPPLY * 40) / 100);     // 40% manufacturers (distribution)
        _mintCapped(address(this), (MAX_SUPPLY * 30) / 100);  // 30% rewards pool (contract balance)
        _mintCapped(msg.sender, (MAX_SUPPLY * 20) / 100);     // 20% ecosystem
        _mintCapped(msg.sender, (MAX_SUPPLY * 10) / 100);     // 10% team (assumed to be vesting off-chain or separate vesting contract)
    }

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "AUTH: not admin");
        _;
    }

    //External: Staking
    /// @notice Stake your AUTH to earn rewards.
    function stake(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "AUTH: zero stake");
        require(balanceOf(msg.sender) >= amount, "AUTH: insufficient balance");

        // Settle any pending rewards first
        _claimRewards(msg.sender);

        // Move tokens into the contract
        _transfer(msg.sender, address(this), amount);

        // Update stake
        StakeInfo storage s = stakes[msg.sender];
        s.amount += amount;
        s.stakedAt = block.timestamp;
        s.unlockAt = block.timestamp + lockPeriod;

        totalStaked += amount;

        emit Staked(msg.sender, amount, s.unlockAt);
    }

    /// @notice Unstake principal (after lock) and auto-claim rewards.
    function unstake(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "AUTH: zero amount");
        StakeInfo storage s = stakes[msg.sender];
        require(s.amount >= amount, "AUTH: insufficient staked");
        require(block.timestamp >= s.unlockAt, "AUTH: stake locked");

        // Calculate reward before reducing principal
        uint256 reward = _pendingReward(msg.sender);

        // Update accounting first (Checks-Effects-Interactions)
        s.amount -= amount;
        totalStaked -= amount;
        s.stakedAt = block.timestamp; // reset accrual window after payout

        // Transfers: principal back to user
        _transfer(address(this), msg.sender, amount);

        // Pay reward if available (won't touch principal pool)
        uint256 paid = _payRewardSafely(msg.sender, reward);
        emit Unstaked(msg.sender, amount, paid);
    }

    /// @notice Claim any pending rewards without changing stake.
    function claimRewards() external whenNotPaused nonReentrant {
        _claimRewards(msg.sender);
    }

    /// @notice Pending reward as of now, in AUTH.
    function pendingReward(address user) external view returns (uint256) {
        return _pendingReward(user);
    }

    /// @notice Available reward pool (excludes staked principal).
    function availableRewardPool() public view returns (uint256) {
        uint256 bal = balanceOf(address(this));
        if (bal <= totalStaked) return 0;
        return bal - totalStaked;
    }

    /// @notice Update APY percentage (max capped for safety).
    function setRewardRate(uint256 newRatePercent) external onlyAdmin {
        require(newRatePercent <= MAX_APY_PERCENT, "AUTH: APY too high");
        rewardRate = newRatePercent;
        emit RewardRateUpdated(newRatePercent);
    }

    /// @notice Update minimum lock period for new/updated stakes.
    function setLockPeriod(uint256 newLockPeriod) external onlyAdmin {
        require(newLockPeriod <= 90 days, "AUTH: lock too long");
        lockPeriod = newLockPeriod;
        emit LockPeriodUpdated(newLockPeriod);
    }

    /// @notice Mint additional rewards into the pool, respecting the cap.
    function topUpRewards(uint256 amount) external onlyRole(MINTER_ROLE) {
        require(amount > 0, "AUTH: zero top-up");
        _mintCapped(address(this), amount);
        emit RewardsToppedUp(amount);
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    /// @dev Core reward calculation: simple linear APY on principal over time.
    function _pendingReward(address user) internal view returns (uint256) {
        StakeInfo memory s = stakes[user];
        if (s.amount == 0) return 0;
        uint256 dt = block.timestamp - s.stakedAt;
        // reward = amount * (rate%) * dt / (100 * seconds/year)
        return (s.amount * rewardRate * dt) / (100 * SECONDS_PER_YEAR);
    }

    /// @dev Claims rewards for `user`, safely bounded by available reward pool.
    function _claimRewards(address user) internal {
        uint256 reward = _pendingReward(user);
        if (reward == 0) {
            // Still refresh timestamp to avoid indefinite accrual if pool was empty before
            if (stakes[user].amount > 0) {
                stakes[user].stakedAt = block.timestamp;
            }
            return;
        }

        uint256 paid = _payRewardSafely(user, reward);
        // Refresh timestamp after paying whatever we could
        stakes[user].stakedAt = block.timestamp;

        if (paid > 0) {
            emit RewardClaimed(user, paid);
        }
    }

    /// @dev Pay reward up to available pool (does not consume staked principal).
    function _payRewardSafely(address to, uint256 desired) internal returns (uint256) {
        uint256 pool = availableRewardPool();
        if (pool == 0) return 0;

        uint256 amt = desired <= pool ? desired : pool;
        if (amt > 0) {
            _transfer(address(this), to, amt);
        }
        return amt;
    }
-
    function _mintCapped(address to, uint256 amount) internal {
        _minted += amount;
        require(_minted <= MAX_SUPPLY, "AUTH: cap exceeded");
        _mint(to, amount);
    }
}
