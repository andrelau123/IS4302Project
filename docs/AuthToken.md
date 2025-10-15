# AuthToken Contract Documentation

## Overview

**AuthToken** is an ERC-20 utility token with staking and reward distribution capabilities. It serves as the primary currency for verification fees, staking, and governance within the supply chain authenticity system.

**Contract:** `contracts/AuthToken.sol`  
**Token:** AUTH  
**Standard:** ERC-20, AccessControl, Pausable, ReentrancyGuard  
**Total Supply:** 1,000,000,000 (1 billion) AUTH tokens

## Purpose

The AuthToken contract provides:
- Utility token for ecosystem operations
- Staking mechanism for verification nodes
- Reward distribution based on APY
- Governance participation rights
- Fee payment for verification services

## Token Distribution

Initial allocation at deployment:
- **40%** (400M tokens) - Manufacturers and product registration
- **30%** (300M tokens) - Staking rewards pool
- **20%** (200M tokens) - Ecosystem development
- **10%** (100M tokens) - Team and advisors (with vesting)

## Key Features

### Staking System
- Users stake AUTH tokens to earn rewards
- Configurable lock period (default: 7 days)
- APY-based rewards (default: 8%, range 5-20%)
- Automatic reward calculation based on time staked
- Safe reward pool management

### Reward Mechanism
- Annual percentage yield calculation
- Rewards accrue continuously
- Claimable at any time
- Separate reward pool prevents principal depletion
- Admin can top up reward pool

### Governance Controls
- Pausable for emergency situations
- Admin-adjustable reward rates
- Configurable lock periods
- Supply cap enforcement

## Core Functions

### Staking Functions

**stake(uint256 amount)**
```solidity
function stake(uint256 amount) external whenNotPaused nonReentrant
```
Stakes AUTH tokens to earn rewards. Requires sufficient balance.

**unstake(uint256 amount)**
```solidity
function unstake(uint256 amount) external whenNotPaused nonReentrant
```
Unstakes tokens after lock period expires. Automatically claims rewards.

**unstake()**
```solidity
function unstake() external whenNotPaused nonReentrant
```
Unstakes all staked tokens. Convenience function for full withdrawal.

**claimRewards()**
```solidity
function claimRewards() external whenNotPaused nonReentrant
```
Claims accumulated rewards without unstaking principal.

### View Functions

**pendingReward(address user)**
```solidity
function pendingReward(address user) external view returns (uint256)
```
Returns unclaimed rewards for a user.

**availableRewardPool()**
```solidity
function availableRewardPool() public view returns (uint256)
```
Returns available tokens in reward pool (excludes staked principal).

### Admin Functions

**setRewardRate(uint256 newRatePercent)**
```solidity
function setRewardRate(uint256 newRatePercent) external onlyAdmin
```
Updates APY percentage (maximum 20%).

**setLockPeriod(uint256 newLockPeriod)**
```solidity
function setLockPeriod(uint256 newLockPeriod) external onlyAdmin
```
Updates minimum staking lock period (maximum 90 days).

**topUpRewards(uint256 amount)**
```solidity
function topUpRewards(uint256 amount) external onlyRole(MINTER_ROLE)
```
Adds tokens to reward pool.

**pause() / unpause()**
```solidity
function pause() external onlyAdmin
function unpause() external onlyAdmin
```
Emergency stop/resume all token operations.

## Staking Mathematics

### Reward Calculation
```
reward = (stakedAmount × rewardRate × timeElapsed) / (100 × secondsPerYear)
```

**Example:**
- Staked: 10,000 AUTH
- Rate: 8% APY
- Time: 30 days
- Reward: 10,000 × 8 × 2,592,000 / (100 × 31,536,000) = 65.75 AUTH

### Lock Period
- Starts when tokens are staked
- Prevents unstaking before expiry
- Protects against quick in-out farming
- Rewards continue accruing during lock

## Events

**Staked**
```solidity
event Staked(address indexed user, uint256 amount, uint256 unlockAt);
```

**Unstaked**
```solidity
event Unstaked(address indexed user, uint256 amount, uint256 reward);
```

**RewardClaimed**
```solidity
event RewardClaimed(address indexed user, uint256 reward);
```

**RewardRateUpdated**
```solidity
event RewardRateUpdated(uint256 newRatePercent);
```

**LockPeriodUpdated**
```solidity
event LockPeriodUpdated(uint256 newLockPeriod);
```

## State Variables

**Staking State**
```solidity
struct StakeInfo {
    uint256 amount;      // Staked principal
    uint256 stakedAt;    // Last reward timestamp
    uint256 unlockAt;    // Cannot unstake before this time
}
mapping(address => StakeInfo) public stakes;
uint256 public totalStaked;
```

**Configuration**
```solidity
uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;
uint256 public constant MAX_APY_PERCENT = 20;
uint256 public rewardRate = 8;           // 8% APY
uint256 public lockPeriod = 7 days;
```

## Integration

### With VerificationManager
```solidity
// Pay verification fees
authToken.transferFrom(requester, verificationManager, fee);

// Verifiers stake AUTH
authToken.transferFrom(verifier, verificationManager, minStake);
```

### With FeeDistributor
```solidity
// Distribute fees to stakeholders
authToken.transfer(verifier, verifierShare);
authToken.transfer(brand, brandShare);
authToken.transfer(treasury, treasuryShare);
```

### With GovernanceVoting
```solidity
// Vote weight based on token balance
uint256 votingPower = authToken.balanceOf(voter);
```

## Usage Examples

### Example 1: Stake Tokens
```javascript
// Approve tokens
await authToken.approve(authToken.address, ethers.parseEther("10000"));

// Stake 10,000 AUTH
await authToken.stake(ethers.parseEther("10000"));

// Check stake info
const stakeInfo = await authToken.stakes(userAddress);
console.log("Staked:", ethers.formatEther(stakeInfo.amount));
console.log("Unlock at:", new Date(stakeInfo.unlockAt * 1000));
```

### Example 2: Claim Rewards
```javascript
// Check pending rewards
const pending = await authToken.pendingReward(userAddress);
console.log("Pending rewards:", ethers.formatEther(pending));

// Claim rewards
await authToken.claimRewards();
```

### Example 3: Unstake After Lock Period
```javascript
// Wait for lock period to expire
const stakeInfo = await authToken.stakes(userAddress);
if (Date.now() / 1000 >= stakeInfo.unlockAt) {
    // Unstake all tokens and claim rewards
    await authToken.unstake();
}
```

## Security Features

**Access Control**
- Role-based permissions (DEFAULT_ADMIN_ROLE, MINTER_ROLE)
- Only admins can modify parameters
- Minter role for reward pool management

**ReentrancyGuard**
- Protects staking and unstaking operations
- Prevents reentrancy exploits

**Pausable**
- Emergency stop capability
- Admin can halt all operations
- Protects during security incidents

**Supply Cap**
- Enforced 1B token maximum
- Prevents inflation attacks
- Verified at deployment

**Safe Reward Distribution**
- Rewards paid from separate pool
- Never consumes staked principal
- Graceful handling of insufficient rewards

## Gas Costs

| Operation | Estimated Gas |
|-----------|---------------|
| Stake | ~125,000 |
| Unstake | ~55,000 |
| Claim Rewards | ~55,000 |
| Transfer | ~54,000 |
| Approve | ~46,000 |

## Best Practices

**For Stakers:**
- Stake long-term to maximize rewards
- Claim rewards periodically
- Monitor reward pool availability
- Understand lock period before staking

**For Administrators:**
- Keep reward pool adequately funded
- Adjust APY based on participation
- Use pause functionality conservatively
- Monitor total staked amount

**For Integrators:**
- Always approve before transfers
- Check allowance before operations
- Handle paused state gracefully
- Monitor events for state changes

## Testing

**Test Coverage:** 24 tests
- Deployment and initialization
- Staking functionality
- Reward calculations
- Unstaking with lock period
- Admin functions
- Pausable operations
- Edge cases

Run tests:
```bash
npx hardhat test test/AuthToken.test.js
```

## Contract Roles

**DEFAULT_ADMIN_ROLE**
- Grant/revoke roles
- Update reward rate and lock period
- Pause/unpause contract

**MINTER_ROLE**
- Top up reward pool
- Mint initial supply (deployment only)

## Deployment

```javascript
const AuthToken = await ethers.getContractFactory("AuthToken");
const authToken = await AuthToken.deploy();
await authToken.waitForDeployment();

// Distribution is automatic:
// - 40% to deployer (for manufacturers)
// - 30% to contract (reward pool)
// - 20% to deployer (ecosystem)
// - 10% to deployer (team)
```

## Version

**Version:** 1.0.0  
**Solidity:** ^0.8.20  
**OpenZeppelin:** ^5.4.0

## License

MIT License

