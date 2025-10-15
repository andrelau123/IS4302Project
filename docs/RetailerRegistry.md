# RetailerRegistry Contract Documentation

## Overview

**RetailerRegistry** manages retailer registration, brand authorization, and multi-factor reputation scoring. It maintains a dynamic reputation system that evaluates retailers based on performance, reliability, and trustworthiness.

**Contract:** `contracts/RetailerRegistry.sol`  
**Standard:** AccessControl, Pausable  
**Purpose:** Retailer authorization and reputation management

## Purpose

The RetailerRegistry contract provides:
- Retailer registration and verification
- Brand-specific authorization management
- Multi-factor reputation scoring (0-1000 scale)
- Performance tracking across multiple dimensions
- Configurable reputation weights and parameters

## Reputation System (Multi-Factor)

The reputation score (0-1000) is calculated from seven factors:

1. **Success Rate** (30% weight) - Verification success history
2. **Volume** (15% weight) - Total products handled
3. **Tenure** (10% weight) - Time active in system
4. **Response Time** (15% weight) - Speed of operations
5. **Dispute History** (20% weight) - Dispute win/loss ratio
6. **Consistency** (10% weight) - Consecutive successful verifications
7. **Decay Multiplier** - Reputation degrades with inactivity

**Default Starting Score:** 500 (neutral)

## Core Data Structures

### Retailer Structure
```solidity
struct Retailer {
    string businessName;
    string location;
    bool isActive;
    uint256 registeredAt;
    uint256 reputationScore;
    uint256 totalVerifications;
    uint256 successfulVerifications;
    uint256 totalProductsHandled;
    uint256 totalDisputesReceived;
    uint256 totalDisputesLost;
    uint256 averageResponseTime;
    uint256 lastActivityTimestamp;
    uint256 consecutiveSuccesses;
    uint256 lifetimeRevenueGenerated;
}
```

### Reputation Weights
```solidity
struct ReputationWeights {
    uint256 successRateWeight;      // Default: 30
    uint256 volumeWeight;            // Default: 15
    uint256 tenureWeight;            // Default: 10
    uint256 responseTimeWeight;      // Default: 15
    uint256 disputeHistoryWeight;    // Default: 20
    uint256 consistencyWeight;       // Default: 10
}
```

## Reputation Calculation

### Composite Score Formula
```
totalScore = (successRate × 30) + (volume × 15) + (tenure × 10) +
             (responseTime × 15) + (dispute × 20) + (consistency × 10)

finalScore = (totalScore × decayMultiplier) / 100
```

### Individual Factor Scoring

**1. Success Rate Score (0-100)**
```
successRate = (successfulVerifications / totalVerifications) × 100
```

**2. Volume Score (0-100)**
```
if (productsHandled >= volumeTierThreshold) → 100
else → (productsHandled / volumeTierThreshold) × 100
```
Default threshold: 100 products

**3. Tenure Score (0-100)**
```
daysActive = (block.timestamp - registeredAt) / 1 day
if (daysActive >= tenureTierThreshold) → 100
else → (daysActive / tenureTierThreshold) × 100
```
Default threshold: 365 days (1 year)

**4. Response Time Score (0-100)**
```
if (averageResponseTime <= optimalResponseTime) → 100
else → max(0, 100 - ((actualTime - optimalTime) / optimalTime) × 100)
```
Default optimal: 3600 seconds (1 hour)

**5. Dispute Score (0-100)**
```
if (totalDisputes == 0) → 100
else → ((totalDisputes - disputesLost) / totalDisputes) × 100
```

**6. Consistency Score (0-100)**
```
if (consecutiveSuccesses >= consistencyThreshold) → 100
else → (consecutiveSuccesses / consistencyThreshold) × 100
```
Default threshold: 10 consecutive successes

**7. Decay Multiplier (50-100%)**
```
inactiveDays = (block.timestamp - lastActivity) / 1 day
if (inactiveDays <= decayPeriod) → 100%
else {
    periods = (inactiveDays - decayPeriod) / decayPeriod
    multiplier = 100 - (periods × decayRate)
    return max(50, multiplier)
}
```
Default: 30-day decay period, 10% decay rate, 50% floor

## Core Functions

### Retailer Management

**registerRetailer(string businessName, string location)**
```solidity
function registerRetailer(string calldata businessName, string calldata location)
    external
    whenNotPaused
    returns (address)
```
Registers a new retailer with neutral reputation score (500).

**deactivateRetailer(address retailer)**
```solidity
function deactivateRetailer(address retailer)
    external
    onlyRole(BRAND_MANAGER_ROLE)
```
Deactivates a retailer.

### Brand Authorization

**authorizeRetailer(address brand, address retailer)**
```solidity
function authorizeRetailer(address brand, address retailer)
    external
    onlyRole(BRAND_MANAGER_ROLE)
    whenNotPaused
```
Authorizes a retailer to sell a brand's products.

**revokeRetailerAuthorization(address brand, address retailer)**
```solidity
function revokeRetailerAuthorization(address brand, address retailer)
    external
    onlyRole(BRAND_MANAGER_ROLE)
```
Revokes brand-specific authorization.

### Reputation Updates

**updateReputation(address retailer, bool success, string reason)**
```solidity
function updateReputation(address retailer, bool success, string calldata reason)
    external
    onlyRole(VERIFIER_ROLE)
```
Updates reputation based on verification outcome.

**recordProductVolume(address retailer, uint256 productsCount)**
```solidity
function recordProductVolume(address retailer, uint256 productsCount)
    external
    onlyRole(DISTRIBUTOR_ROLE)
```
Records products handled by retailer.

**recordResponseTime(address retailer, uint256 responseTime)**
```solidity
function recordResponseTime(address retailer, uint256 responseTime)
    external
    onlyRole(VERIFIER_ROLE)
```
Updates average response time.

**recordDispute(address retailer, bool retailerWon)**
```solidity
function recordDispute(address retailer, bool retailerWon)
    external
    onlyRole(VERIFIER_ROLE)
```
Records dispute outcome.

**recordRevenue(address retailer, uint256 revenueAmount)**
```solidity
function recordRevenue(address retailer, uint256 revenueAmount)
    external
    onlyRole(DISTRIBUTOR_ROLE)
```
Tracks lifetime revenue generated.

### Configuration

**updateReputationWeights(ReputationWeights newWeights)**
```solidity
function updateReputationWeights(ReputationWeights calldata newWeights)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
```
Updates factor weights (must total 100).

**setVolumeTierThreshold(uint256 threshold)**
**setTenureTierThreshold(uint256 threshold)**
**setOptimalResponseTime(uint256 timeInSeconds)**
**setConsistencyThreshold(uint256 threshold)**
**setDecayParameters(uint256 period, uint256 rate)**

Admin functions to configure reputation parameters.

### View Functions

**getRetailer(address retailer)**
```solidity
function getRetailer(address retailer)
    external
    view
    returns (Retailer memory)
```
Returns complete retailer information.

**getReputationScore(address retailer)**
```solidity
function getReputationScore(address retailer)
    external
    view
    returns (uint256)
```
Returns current reputation score (0-1000).

**getReputationBreakdown(address retailer)**
```solidity
function getReputationBreakdown(address retailer)
    external
    view
    returns (
        uint256 successRateScore,
        uint256 volumeScore,
        uint256 tenureScore,
        uint256 responseTimeScore,
        uint256 disputeScore,
        uint256 consistencyScore,
        uint256 decayMultiplier
    )
```
Returns individual component scores for analysis.

**isAuthorizedRetailer(address brand, address retailer)**
```solidity
function isAuthorizedRetailer(address brand, address retailer)
    external
    view
    returns (bool)
```
Checks if retailer is authorized and active.

## Events

**RetailerRegistered**
```solidity
event RetailerRegistered(
    address indexed retailer,
    string businessName,
    uint256 timestamp
);
```

**RetailerAuthorized**
```solidity
event RetailerAuthorized(
    address indexed brand,
    address indexed retailer
);
```

**AuthorizationRevoked**
```solidity
event AuthorizationRevoked(
    address indexed brand,
    address indexed retailer
);
```

**ReputationUpdated**
```solidity
event ReputationUpdated(
    address indexed retailer,
    uint256 oldScore,
    uint256 newScore,
    string updateReason
);
```

## Usage Examples

### Example 1: Register and Authorize Retailer
```javascript
// Retailer registers
await retailerRegistry.registerRetailer(
    "Premium Electronics Store",
    "New York, USA"
);

// Brand manager authorizes retailer
await retailerRegistry.connect(brandManager).authorizeRetailer(
    brandAddress,
    retailerAddress
);

// Check authorization
const isAuthorized = await retailerRegistry.isAuthorizedRetailer(
    brandAddress,
    retailerAddress
);
console.log("Authorized:", isAuthorized);
```

### Example 2: Track Performance
```javascript
// Record successful verification
await retailerRegistry.connect(verifier).updateReputation(
    retailerAddress,
    true,
    "Product verified successfully"
);

// Record product volume
await retailerRegistry.connect(distributor).recordProductVolume(
    retailerAddress,
    50 // 50 products handled
);

// Record fast response
await retailerRegistry.connect(verifier).recordResponseTime(
    retailerAddress,
    1800 // 30 minutes
);

// Check updated score
const score = await retailerRegistry.getReputationScore(retailerAddress);
console.log("New score:", score); // Should increase
```

### Example 3: Analyze Reputation
```javascript
// Get detailed breakdown
const breakdown = await retailerRegistry.getReputationBreakdown(retailerAddress);

console.log("Success Rate Score:", breakdown[0]);
console.log("Volume Score:", breakdown[1]);
console.log("Tenure Score:", breakdown[2]);
console.log("Response Time Score:", breakdown[3]);
console.log("Dispute Score:", breakdown[4]);
console.log("Consistency Score:", breakdown[5]);
console.log("Decay Multiplier:", breakdown[6], "%");

// Identify weak areas for improvement
```

### Example 4: Handle Disputes
```javascript
// Retailer loses a dispute
await retailerRegistry.connect(verifier).recordDispute(
    retailerAddress,
    false // Retailer lost
);

// Check impact on reputation
const newScore = await retailerRegistry.getReputationScore(retailerAddress);
// Score should decrease due to dispute loss
```

## Reputation Score Ranges

| Score | Rating | Description |
|-------|--------|-------------|
| 900-1000 | Excellent | Top-tier retailer |
| 750-899 | Very Good | Highly reliable |
| 600-749 | Good | Solid performance |
| 500-599 | Neutral | New or average |
| 350-499 | Below Average | Needs improvement |
| 200-349 | Poor | Significant issues |
| 0-199 | Critical | Major problems |

## Integration

### With ProductRegistry
```solidity
// Validates transfer recipients
require(
    retailerRegistry.isAuthorizedRetailer(brand, recipient),
    "Not authorized"
);
```

### With VerificationManager
```solidity
// Update reputation after verification
retailerRegistry.updateReputation(retailer, success, reason);
```

### With ProductNFT
```solidity
// Check retailer authorization for NFT transfers
bool canReceive = retailerRegistry.isAuthorizedRetailer(brand, recipient);
```

## Security Features

**Access Control**
- **BRAND_MANAGER_ROLE**: Authorize/revoke retailers
- **VERIFIER_ROLE**: Update reputation, record disputes
- **DISTRIBUTOR_ROLE**: Record volume and revenue
- **DEFAULT_ADMIN_ROLE**: Configure parameters

**Reputation Protection**
- Decay system prevents stale high scores
- Floor at 50% prevents complete reputation loss
- Weighted scoring balances factors
- Admin can adjust weights for fairness

**Authorization Safety**
- Checks both authorization and active status
- Can revoke without deleting data
- Brand-specific authorization isolation

## Gas Costs

| Operation | Estimated Gas |
|-----------|---------------|
| Register Retailer | ~180,000 |
| Authorize Retailer | ~90,000 |
| Update Reputation | ~120,000 |
| Record Metrics | ~60,000 |
| View Functions | <10,000 |

## Best Practices

**For Retailers:**
- Maintain consistent performance
- Respond quickly to requests
- Handle disputes professionally
- Stay active to avoid decay

**For Brand Managers:**
- Vet retailers before authorization
- Monitor reputation scores regularly
- Revoke authorization for poor performers
- Use reputation breakdown for insights

**For System Administrators:**
- Adjust weights based on ecosystem needs
- Set realistic thresholds
- Monitor decay parameters
- Balance factors appropriately

## Testing

**Test Coverage:** 23 tests
- Retailer registration
- Brand authorization
- Reputation updates
- Multi-factor scoring
- Configuration
- Edge cases

Run tests:
```bash
npx hardhat test test/RetailerRegistry.test.js
```

## Contract Roles

**BRAND_MANAGER_ROLE**
- Authorize/revoke retailers
- Deactivate retailers

**VERIFIER_ROLE**
- Update reputation
- Record response times
- Record disputes

**DISTRIBUTOR_ROLE**
- Record product volume
- Record revenue

**DEFAULT_ADMIN_ROLE**
- Configure reputation parameters
- Update weights
- Pause/unpause

## Deployment

```javascript
const RetailerRegistry = await ethers.getContractFactory("RetailerRegistry");
const retailerRegistry = await RetailerRegistry.deploy();
await retailerRegistry.waitForDeployment();

// Grant roles
await retailerRegistry.grantRole(BRAND_MANAGER_ROLE, brandManagerAddress);
await retailerRegistry.grantRole(VERIFIER_ROLE, verifierAddress);
```

## Version

**Version:** 2.0.0 (Enhanced Multi-Factor)  
**Solidity:** ^0.8.20  
**Upgrade:** Added 7-factor reputation system

## License

MIT License

