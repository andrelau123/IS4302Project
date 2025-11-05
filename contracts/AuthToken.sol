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

    // ETH to AUTH exchange rate: 1 ETH = 10,000 AUTH
    uint256 public constant AUTH_PER_ETH = 10_000 * 10 ** 18;

    uint256 public totalStaked;
    uint256 private _minted; // track total minted to enforce cap
    uint256 public rewardPerTokenStored;
    uint256 public lastUpdateTime;

    struct StakeInfo {
        uint256 amount; // staked principal
        uint256 unlockAt; // cannot unstake before this time
        uint256 userRewardPerTokenPaid; // Snapshot of rewardPerTokenStored when user last interacted
        uint256 rewards; // Earned but not yet claimed
    }

    mapping(address => StakeInfo) public stakes;

    /// @dev Annual percentage yield (integer percent). Example: 8 means 8% APY.
    uint256 public rewardRate = 8;

    /// @dev Minimum lock time for any new/updated stake.
    uint256 public lockPeriod = 7 days;

    event Staked(address indexed user, uint256 amount, uint256 unlockAt);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event RewardClaimed(address indexed user, uint256 reward);
    event AuthPurchased(
        address indexed buyer,
        uint256 ethAmount,
        uint256 authAmount
    );
    event AuthSold(address indexed seller, uint256 authAmount, uint256 ethAmount);
    event ETHWithdrawn(address indexed recipient, uint256 amount);

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;

        if (account != address(0)) {
            stakes[account].rewards = earned(account);
            stakes[account].userRewardPerTokenPaid = rewardPerTokenStored;
        }
        _;
    }

    constructor() ERC20("Auth Token", "AUTH") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        lastUpdateTime = block.timestamp;

        // Initial distribution (100% of MAX_SUPPLY)
        _mintCapped(msg.sender, (MAX_SUPPLY * 40) / 100); // 40% manufacturers (distribution)
        _mintCapped(address(this), (MAX_SUPPLY * 30) / 100); // 30% rewards pool (contract balance)
        _mintCapped(msg.sender, (MAX_SUPPLY * 20) / 100); // 20% ecosystem
        _mintCapped(msg.sender, (MAX_SUPPLY * 10) / 100); // 10% team (assumed to be vesting off-chain or separate vesting contract)
    }

    // Calculate reward per staked token
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }

        uint256 timeDelta = block.timestamp - lastUpdateTime;
        // rewardRate is annual %, convert to per-second rate
        uint256 ratePerSecond = (rewardRate * 1e18) / (100 * SECONDS_PER_YEAR);

        return rewardPerTokenStored + (timeDelta * ratePerSecond);
    }

    // Calculate rewards earned by an account
    function earned(address account) public view returns (uint256) {
        StakeInfo memory s = stakes[account];

        uint256 rewardDelta = rewardPerToken() - s.userRewardPerTokenPaid;
        uint256 newRewards = (s.amount * rewardDelta) / 1e18;

        return s.rewards + newRewards;
    }

    //External: Staking
    /// @notice Stake your AUTH to earn rewards.
    function stake(
        uint256 amount
    ) external whenNotPaused nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Amount=0");
        require(balanceOf(msg.sender) >= amount, "AUTH: insufficient balance");

        // Move tokens into the contract
        _transfer(msg.sender, address(this), amount);

        // Update stake
        StakeInfo storage s = stakes[msg.sender];
        s.amount += amount;
        s.unlockAt = block.timestamp + lockPeriod;

        totalStaked += amount;

        emit Staked(msg.sender, amount, s.unlockAt);
    }

    /// @notice Unstake principal (after lock) and auto-claim rewards.
    function unstake(
        uint256 amount
    ) external whenNotPaused nonReentrant updateReward(msg.sender) {
        require(amount > 0, "AUTH: zero amount");
        StakeInfo storage s = stakes[msg.sender];
        require(s.amount >= amount, "AUTH: insufficient staked");
        require(block.timestamp >= s.unlockAt, "Still locked");

        s.amount -= amount;
        totalStaked -= amount;

        // Transfers: principal back to user
        _transfer(address(this), msg.sender, amount);

        // Auto-claim rewards
        uint256 reward = s.rewards;
        if (reward > 0) {
            s.rewards = 0;
            uint256 paid = _payRewardSafely(msg.sender, reward);
            emit Unstaked(msg.sender, amount, paid);
        } else {
            emit Unstaked(msg.sender, amount, 0);
        }
    }

    /// @notice Unstake all principal and claim rewards (for tests)
    function unstake()
        external
        whenNotPaused
        nonReentrant
        updateReward(msg.sender)
    {
        StakeInfo storage s = stakes[msg.sender];
        uint256 amount = s.amount;
        require(amount > 0, "No stake");
        require(block.timestamp >= s.unlockAt, "Still locked");

        // Update accounting first
        s.amount = 0;
        totalStaked -= amount;

        // Transfer principal back to user
        _transfer(address(this), msg.sender, amount);

        uint256 reward = s.rewards;
        if (reward > 0) {
            s.rewards = 0;
            uint256 paid = _payRewardSafely(msg.sender, reward);
            emit Unstaked(msg.sender, amount, paid);
        } else {
            emit Unstaked(msg.sender, amount, 0);
        }
    }

    /// @notice Claim any pending rewards without changing stake.
    function claimRewards()
        external
        whenNotPaused
        nonReentrant
        updateReward(msg.sender)
    {
        uint256 reward = stakes[msg.sender].rewards;
        require(reward > 0, "No rewards");

        stakes[msg.sender].rewards = 0;
        uint256 paid = _payRewardSafely(msg.sender, reward);

        if (paid > 0) {
            emit RewardClaimed(msg.sender, paid);
        }
    }

    /// @notice Pending reward as of now, in AUTH.
    function pendingReward(address user) external view returns (uint256) {
        return earned(user);
    }

    /// @notice Available reward pool (excludes staked principal).
    function availableRewardPool() public view returns (uint256) {
        uint256 bal = balanceOf(address(this));
        if (bal <= totalStaked) return 0;
        return bal - totalStaked;
    }

    function _payRewardSafely(
        address to,
        uint256 desired
    ) internal returns (uint256) {
        uint256 pool = availableRewardPool();
        if (pool == 0) return 0;

        uint256 amt = desired <= pool ? desired : pool;
        if (amt > 0) {
            _transfer(address(this), to, amt);
        }
        return amt;
    }

    /// @notice Update APY percentage (max capped for safety).
    function setRewardRate(
        uint256 newRatePercent
    ) external onlyRole(DEFAULT_ADMIN_ROLE) updateReward(address(0)) {
        require(newRatePercent <= MAX_APY_PERCENT, "Rate too high");
        rewardRate = newRatePercent;
    }

    /// @notice Update minimum lock period for new/updated stakes.
    function setLockPeriod(
        uint256 newLockPeriod
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newLockPeriod <= 90 days, "AUTH: lock too long");
        lockPeriod = newLockPeriod;
    }

    /// @notice Transfer additional rewards into the pool from caller's balance.
    function topUpRewards(uint256 amount) external onlyRole(MINTER_ROLE) {
        require(amount > 0, "AUTH: zero top-up");
        require(balanceOf(msg.sender) >= amount, "AUTH: insufficient balance");
        _transfer(msg.sender, address(this), amount);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Buy AUTH tokens with ETH at fixed rate (1 ETH = 10,000 AUTH)
    /// @dev Requires contract to have sufficient AUTH balance (from rewards pool)
    function buyAuthWithETH() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Must send ETH");

        uint256 authAmount = (msg.value * AUTH_PER_ETH) / 1 ether;
        require(authAmount > 0, "Amount too small");
        require(
            balanceOf(address(this)) >= authAmount,
            "Insufficient AUTH in contract"
        );

        // Transfer AUTH from contract to buyer
        _transfer(address(this), msg.sender, authAmount);

        emit AuthPurchased(msg.sender, msg.value, authAmount);
    }

    /// @notice Sell AUTH tokens back to the contract for ETH at the fixed rate (1 ETH = AUTH_PER_ETH)
    /// @dev User's AUTH tokens are transferred into the contract and the contract pays ETH if it has enough balance
    function sellAuthForETH(uint256 authAmount) external nonReentrant whenNotPaused {
        require(authAmount > 0, "AUTH: zero amount");
        // Ensure user's totalAuth tracking and actual balance are sufficient
        require(balanceOf(msg.sender) >= authAmount, "AUTH: insufficient balance");

        // Transfer AUTH from seller into the contract
        _transfer(msg.sender, address(this), authAmount);

        // Compute ETH amount in wei: ethAmount = authAmount / AUTH_PER_ETH (scaled)
        uint256 ethAmount = (authAmount * 1 ether) / AUTH_PER_ETH;
        require(ethAmount > 0, "ETH amount too small");
        require(address(this).balance >= ethAmount, "Insufficient ETH in contract");

        (bool success, ) = payable(msg.sender).call{value: ethAmount}("");
        require(success, "ETH transfer failed");

        emit AuthSold(msg.sender, authAmount, ethAmount);
    }

    /// @notice Admin can withdraw collected ETH
    function withdrawETH(
        address payable recipient,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(recipient != address(0), "Invalid recipient");
        require(amount <= address(this).balance, "Insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit ETHWithdrawn(recipient, amount);
    }

    function _mintCapped(address to, uint256 amount) internal {
        _minted += amount;
        require(_minted <= MAX_SUPPLY, "AUTH: cap exceeded");
        _mint(to, amount);
    }

    /// @notice Override _update to enforce pausable transfers
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        // Allow minting (from == address(0)) and internal contract operations
        if (from != address(0) && to != address(this)) {
            require(!paused(), "Pausable: paused");
        }
        super._update(from, to, value);
    }
}
