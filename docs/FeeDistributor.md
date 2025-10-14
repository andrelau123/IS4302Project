# FeeDistributor Contract Documentation

## Overview

**FeeDistributor** manages automated revenue sharing from verification fees to multiple stakeholders. It handles proportional distribution, reward accumulation, and claim processing for verifiers, brands, and the protocol treasury.

**Contract:** `contracts/FeeDistributor.sol`  
**Standard:** AccessControl, ReentrancyGuard, Pausable  
**Purpose:** Automated fee distribution and revenue management

## Purpose

The FeeDistributor contract provides:
- Proportional fee splitting among stakeholders
- Accumulated reward tracking per recipient
- Pull-based claim system for gas efficiency
- Configurable distribution ratios
- Transparent revenue accounting

## Revenue Distribution Model

### Default Distribution Shares
```
Total Fee: 100%
├─ Verifier: 60%    (Performs verification)
├─ Brand: 25%       (Product owner)
└─ Treasury: 15%    (Protocol maintenance)
```

**Configurable via:** `updateFeeShares()`

### Distribution Calculation
```
verifierAmount = totalFee × verifierShareBps / 10000
brandAmount = totalFee × brandShareBps / 10000
treasuryAmount = totalFee - verifierAmount - brandAmount
```

**Example (100 ETH fee):**
- Verifier: 60 ETH
- Brand: 25 ETH
- Treasury: 15 ETH

## Core Data Structures

### Share Configuration
```solidity
uint256 public verifierShareBps = 6000;  // 60% in basis points
uint256 public brandShareBps = 2500;     // 25%
uint256 public treasuryShareBps = 1500;  // 15%

uint256 private constant BPS_DENOMINATOR = 10000;
```

### Accumulated Rewards
```solidity
mapping(address => uint256) public accumulatedRewards;
mapping(address => uint256) public totalClaimed;
mapping(address => uint256) public totalEarned;
```

## Core Functions

### Fee Distribution

**distributeFees(address verifier, address brand, bytes32 requestId)**
```solidity
function distributeFees(
    address verifier,
    address brand,
    bytes32 requestId
) external payable onlyRole(DISTRIBUTOR_ROLE) nonReentrant whenNotPaused
```
Distributes incoming verification fee to stakeholders. Accumulates rewards for claiming.

**Parameters:**
- `verifier`: Verification performer address
- `brand`: Product brand owner address
- `requestId`: Verification request identifier

**Requirements:**
- Caller has DISTRIBUTOR_ROLE (typically VerificationManager)
- Must send ETH with transaction

### Reward Claims

**claimRewards()**
```solidity
function claimRewards() external nonReentrant whenNotPaused
```
Claims all accumulated rewards for caller.

**claimRewardsFor(address recipient)**
```solidity
function claimRewardsFor(address recipient)
    external
    nonReentrant
    whenNotPaused
```
Claims accumulated rewards for specified recipient.

### Configuration

**updateFeeShares(uint256 verifierBps, uint256 brandBps, uint256 treasuryBps)**
```solidity
function updateFeeShares(
    uint256 verifierBps,
    uint256 brandBps,
    uint256 treasuryBps
) external onlyRole(DEFAULT_ADMIN_ROLE)
```
Updates distribution percentages. Must total 10,000 (100%).

**setTreasuryAddress(address newTreasury)**
```solidity
function setTreasuryAddress(address newTreasury)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
```
Updates protocol treasury address.

### View Functions

**getAccumulatedRewards(address recipient)**
```solidity
function getAccumulatedRewards(address recipient)
    external
    view
    returns (uint256)
```
Returns unclaimed rewards for address.

**getTotalEarned(address recipient)**
```solidity
function getTotalEarned(address recipient)
    external
    view
    returns (uint256)
```
Returns total lifetime earnings.

**getTotalClaimed(address recipient)**
```solidity
function getTotalClaimed(address recipient)
    external
    view
    returns (uint256)
```
Returns total claimed amount.

**getCurrentShares()**
```solidity
function getCurrentShares()
    external
    view
    returns (uint256 verifier, uint256 brand, uint256 treasury)
```
Returns current distribution percentages in basis points.

## Events

**FeesDistributed**
```solidity
event FeesDistributed(
    bytes32 indexed requestId,
    address indexed verifier,
    address indexed brand,
    uint256 verifierAmount,
    uint256 brandAmount,
    uint256 treasuryAmount
);
```

**RewardsClaimed**
```solidity
event RewardsClaimed(
    address indexed recipient,
    uint256 amount
);
```

**FeeSharesUpdated**
```solidity
event FeeSharesUpdated(
    uint256 verifierShareBps,
    uint256 brandShareBps,
    uint256 treasuryShareBps
);
```

**TreasuryAddressUpdated**
```solidity
event TreasuryAddressUpdated(
    address indexed oldTreasury,
    address indexed newTreasury
);
```

## Pull vs Push Pattern

**Why Pull Pattern?**
- Gas efficiency (recipients pay own claim gas)
- Prevents DoS from failing recipient transfers
- Allows reward accumulation before claiming
- Better security (no external calls during distribution)

**How It Works:**
```
1. Distribution → Accumulate rewards (state update only)
2. Recipient calls claim → Transfer accumulated rewards
3. State updated → Prevents double claiming
```

## Integration

### With VerificationManager
```solidity
// VerificationManager distributes fees
feeDistributor.distributeFees{value: fee}(
    verifier,
    brand,
    requestId
);
```

### With AuthToken (Alternative)
```solidity
// If using ERC-20 fees instead of ETH
authToken.transfer(feeDistributor, fee);
feeDistributor.distributeFees(verifier, brand, requestId);
```

## Usage Examples

### Example 1: Distribute Verification Fee
```javascript
// From VerificationManager
const fee = ethers.parseEther("1"); // 1 ETH verification fee

await feeDistributor.connect(verificationManager).distributeFees(
    verifierAddress,
    brandAddress,
    requestId,
    { value: fee }
);

// Check accumulated rewards
const verifierRewards = await feeDistributor.getAccumulatedRewards(verifierAddress);
console.log("Verifier earned:", ethers.formatEther(verifierRewards)); // 0.6 ETH

const brandRewards = await feeDistributor.getAccumulatedRewards(brandAddress);
console.log("Brand earned:", ethers.formatEther(brandRewards)); // 0.25 ETH

const treasuryRewards = await feeDistributor.getAccumulatedRewards(treasuryAddress);
console.log("Treasury earned:", ethers.formatEther(treasuryRewards)); // 0.15 ETH
```

### Example 2: Claim Rewards
```javascript
// Verifier claims accumulated rewards
const beforeBalance = await ethers.provider.getBalance(verifierAddress);

await feeDistributor.connect(verifier).claimRewards();

const afterBalance = await ethers.provider.getBalance(verifierAddress);
const received = afterBalance - beforeBalance;

console.log("Claimed:", ethers.formatEther(received));
```

### Example 3: Update Distribution Shares
```javascript
// Admin updates shares (70% verifier, 20% brand, 10% treasury)
await feeDistributor.connect(admin).updateFeeShares(
    7000, // 70% to verifier
    2000, // 20% to brand
    1000  // 10% to treasury
);

// Verify new shares
const shares = await feeDistributor.getCurrentShares();
console.log("Verifier:", shares[0] / 100, "%");
console.log("Brand:", shares[1] / 100, "%");
console.log("Treasury:", shares[2] / 100, "%");
```

### Example 4: Track Lifetime Earnings
```javascript
// Get comprehensive stats
const accumulated = await feeDistributor.getAccumulatedRewards(verifierAddress);
const claimed = await feeDistributor.getTotalClaimed(verifierAddress);
const totalEarned = await feeDistributor.getTotalEarned(verifierAddress);

console.log("Total earned:", ethers.formatEther(totalEarned));
console.log("Already claimed:", ethers.formatEther(claimed));
console.log("Available to claim:", ethers.formatEther(accumulated));

// Verify: totalEarned === claimed + accumulated
```

## Revenue Sharing Scenarios

### Scenario 1: High-Value Verification
```
Verification Fee: 10 ETH (high-value luxury product)

Distribution:
├─ Verifier: 6 ETH (60%)
├─ Brand: 2.5 ETH (25%)
└─ Treasury: 1.5 ETH (15%)
```

### Scenario 2: Standard Verification
```
Verification Fee: 0.1 ETH (standard product)

Distribution:
├─ Verifier: 0.06 ETH (60%)
├─ Brand: 0.025 ETH (25%)
└─ Treasury: 0.015 ETH (15%)
```

### Scenario 3: Custom Shares (Premium Program)
```
Verification Fee: 1 ETH
Custom Shares: 70% / 20% / 10%

Distribution:
├─ Verifier: 0.7 ETH (70%)
├─ Brand: 0.2 ETH (20%)
└─ Treasury: 0.1 ETH (10%)
```

## Security Features

**Access Control**
- **DISTRIBUTOR_ROLE**: Call distributeFees (VerificationManager)
- **DEFAULT_ADMIN_ROLE**: Update shares, set treasury

**ReentrancyGuard**
- Protects claim operations
- Prevents reentrancy during distribution

**Pull Pattern**
- No external calls during distribution
- Recipient controls claim timing
- Prevents DoS attacks

**State Validation**
- Share percentages must total 100%
- Treasury address cannot be zero
- Amount checks before transfer

**Pausable**
- Emergency stop capability
- Admin-controlled

## Gas Costs

| Operation | Estimated Gas |
|-----------|---------------|
| Distribute Fees | ~120,000 |
| Claim Rewards | ~55,000 |
| Update Shares | ~45,000 |
| View Functions | <10,000 |

## Best Practices

**For Verifiers:**
- Claim rewards periodically to realize earnings
- Monitor accumulated rewards
- Consider gas costs for small claims

**For Brands:**
- Automate reward claims or batch claims
- Track earnings for accounting
- Verify distribution percentages

**For Administrators:**
- Set fair distribution ratios
- Review shares based on ecosystem health
- Maintain treasury funding for operations
- Monitor total distributed amounts

**For Integrators:**
- Only distribute actual received fees
- Validate recipient addresses
- Handle claim failures gracefully
- Monitor events for accounting

## Revenue Analytics

### Tracking Total Distribution
```javascript
// Listen to distribution events
feeDistributor.on("FeesDistributed", (requestId, verifier, brand, vAmt, bAmt, tAmt) => {
    console.log("Request:", requestId);
    console.log("Verifier earned:", ethers.formatEther(vAmt));
    console.log("Brand earned:", ethers.formatEther(bAmt));
    console.log("Treasury earned:", ethers.formatEther(tAmt));
    console.log("Total distributed:", ethers.formatEther(vAmt + bAmt + tAmt));
});
```

### Recipient Dashboard
```javascript
async function getDashboard(address) {
    const accumulated = await feeDistributor.getAccumulatedRewards(address);
    const claimed = await feeDistributor.getTotalClaimed(address);
    const totalEarned = await feeDistributor.getTotalEarned(address);
    
    return {
        totalEarned: ethers.formatEther(totalEarned),
        claimed: ethers.formatEther(claimed),
        pending: ethers.formatEther(accumulated),
        claimRate: (claimed / totalEarned * 100).toFixed(2) + "%"
    };
}
```

## Testing

**Test Coverage:** 23 tests
- Fee distribution
- Share calculations
- Reward claims
- Configuration updates
- Edge cases

Run tests:
```bash
npx hardhat test test/FeeDistributor.test.js
```

## Contract Roles

**DISTRIBUTOR_ROLE**
- Distribute verification fees
- Typically granted to VerificationManager

**DEFAULT_ADMIN_ROLE**
- Update fee shares
- Set treasury address
- Pause/unpause contract

## Deployment

```javascript
const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
const feeDistributor = await FeeDistributor.deploy(treasuryAddress);
await feeDistributor.waitForDeployment();

// Grant distributor role to VerificationManager
await feeDistributor.grantRole(DISTRIBUTOR_ROLE, verificationManagerAddress);

// Optional: Customize shares
await feeDistributor.updateFeeShares(7000, 2000, 1000);
```

## Version

**Version:** 1.0.0  
**Solidity:** ^0.8.20  
**Pattern:** Pull over Push  
**Dependencies:** None

## License

MIT License

