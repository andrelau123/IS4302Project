# VerificationManager Contract Documentation

## Overview

**VerificationManager** coordinates product verification requests, manages verifier stakes, calculates fees, and distributes rewards. It acts as the central hub for authentication workflows in the supply chain system.

**Contract:** `contracts/VerificationManager.sol`  
**Standard:** AccessControl, Pausable, ReentrancyGuard  
**Purpose:** Verification workflow orchestration and fee management

## Purpose

The VerificationManager contract provides:
- Verification request creation and lifecycle management
- Verifier staking and slashing mechanism
- Dynamic fee calculation based on product value
- Fee distribution to stakeholders
- Timeout handling for incomplete verifications
- Integration with multiple ecosystem contracts

## Verification Lifecycle

```
Pending → InProgress → Completed
   ↓           ↓            
   └──────→ Timeout ←───────┘
```

**VerificationStatus Enum:**
- **Pending**: Awaiting verifier assignment
- **InProgress**: Active verification underway
- **Completed**: Successfully verified
- **Timeout**: Exceeded deadline without completion

## Core Data Structures

### Verification Request
```solidity
struct VerificationRequest {
    bytes32 requestId;
    bytes32 productId;
    address requester;
    address verifier;
    uint256 requestedAt;
    uint256 completedAt;
    uint256 fee;
    uint256 deadline;
    VerificationStatus status;
    bool isAuthentic;
    string evidenceURI;
}
```

### Verifier Info
```solidity
struct VerifierInfo {
    uint256 stakedAmount;
    uint256 totalVerifications;
    uint256 successfulVerifications;
    bool isActive;
    uint256 lastActivityAt;
}
```

## Fee Calculation

### Dynamic Fee Formula
```
baseFee = BASE_FEE (0.01 ETH default)

if (productValue > 0):
    valueFee = (productValue × feeRate) / FEE_DENOMINATOR
    totalFee = baseFee + valueFee
else:
    totalFee = baseFee

feeRate = 250 (2.5% default)
FEE_DENOMINATOR = 10,000
```

**Example:**
- Product value: 10 ETH
- Base fee: 0.01 ETH
- Value fee: 10 × 0.025 = 0.25 ETH
- **Total: 0.26 ETH**

## Core Functions

### Verification Request

**requestVerification(bytes32 productId, uint256 productValue)**
```solidity
function requestVerification(bytes32 productId, uint256 productValue)
    external
    payable
    nonReentrant
    whenNotPaused
    returns (bytes32)
```
Creates verification request. Requires payment of calculated fee.

**Parameters:**
- `productId`: Product to verify
- `productValue`: Estimated value for fee calculation

**Returns:**
- `bytes32`: Unique request ID

### Verifier Operations

**assignVerifier(bytes32 requestId, address verifier)**
```solidity
function assignVerifier(bytes32 requestId, address verifier)
    external
    onlyRole(VERIFIER_ROLE)
```
Assigns verifier to pending request.

**completeVerification(bytes32 requestId, bool isAuthentic, string evidenceURI)**
```solidity
function completeVerification(
    bytes32 requestId,
    bool isAuthentic,
    string calldata evidenceURI
) external nonReentrant
```
Completes verification and triggers fee distribution.

**handleTimeout(bytes32 requestId)**
```solidity
function handleTimeout(bytes32 requestId)
    external
    nonReentrant
```
Handles timed-out verifications, refunds requester, slashes verifier.

### Verifier Staking

**stakeAsVerifier()**
```solidity
function stakeAsVerifier()
    external
    payable
    nonReentrant
```
Stakes tokens to become eligible verifier. Requires minimum stake (0.1 ETH default).

**unstake()**
```solidity
function unstake()
    external
    nonReentrant
```
Withdraws stake. Only allowed if no pending verifications.

### Fee Management

**calculateVerificationFee(uint256 productValue)**
```solidity
function calculateVerificationFee(uint256 productValue)
    public
    view
    returns (uint256)
```
Returns calculated fee for given product value.

**setBaseFee(uint256 newBaseFee)**
```solidity
function setBaseFee(uint256 newBaseFee)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
```
Updates base verification fee.

**setFeeRate(uint256 newFeeRate)**
```solidity
function setFeeRate(uint256 newFeeRate)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
```
Updates value-based fee percentage.

**setMinStake(uint256 newMinStake)**
```solidity
function setMinStake(uint256 newMinStake)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
```
Updates minimum verifier stake requirement.

### View Functions

**getVerificationRequest(bytes32 requestId)**
```solidity
function getVerificationRequest(bytes32 requestId)
    external
    view
    returns (VerificationRequest memory)
```

**getVerifierInfo(address verifier)**
```solidity
function getVerifierInfo(address verifier)
    external
    view
    returns (VerifierInfo memory)
```

**isActiveVerifier(address verifier)**
```solidity
function isActiveVerifier(address verifier)
    external
    view
    returns (bool)
```

## Events

**VerificationRequested**
```solidity
event VerificationRequested(
    bytes32 indexed requestId,
    bytes32 indexed productId,
    address indexed requester,
    uint256 fee
);
```

**VerifierAssigned**
```solidity
event VerifierAssigned(
    bytes32 indexed requestId,
    address indexed verifier
);
```

**VerificationCompleted**
```solidity
event VerificationCompleted(
    bytes32 indexed requestId,
    address indexed verifier,
    bool isAuthentic
);
```

**VerificationTimeout**
```solidity
event VerificationTimeout(
    bytes32 indexed requestId,
    address indexed verifier
);
```

**VerifierStaked**
```solidity
event VerifierStaked(
    address indexed verifier,
    uint256 amount
);
```

**VerifierSlashed**
```solidity
event VerifierSlashed(
    address indexed verifier,
    uint256 amount,
    string reason
);
```

**FeeDistributed**
```solidity
event FeeDistributed(
    bytes32 indexed requestId,
    uint256 verifierShare,
    uint256 brandShare,
    uint256 treasuryShare
);
```

## Slashing Mechanism

**When Slashing Occurs:**
- Verification timeout (missed deadline)
- False verification (if proven fraudulent)

**Slash Amount:**
```
slashAmount = min(stakedAmount, SLASH_PERCENTAGE × stakedAmount)
SLASH_PERCENTAGE = 10% (default)
```

**Post-Slash:**
- Slashed funds sent to treasury
- Verifier's stake reduced
- If stake < minStake, verifier deactivated

## Integration

### With AuthToken
```solidity
// Fee payment in AUTH tokens
authToken.transferFrom(requester, address(this), fee);
```

### With ProductRegistry
```solidity
// Record verification result
productRegistry.recordVerification(productId, keccak256(requestId));
```

### With FeeDistributor
```solidity
// Distribute fees to stakeholders
feeDistributor.distributeFees{value: fee}(
    verifier,
    brand,
    requestId
);
```

### With RetailerRegistry
```solidity
// Update verifier reputation
retailerRegistry.updateReputation(verifier, success, reason);
```

## Usage Examples

### Example 1: Request Verification
```javascript
// Calculate fee
const productValue = ethers.parseEther("10"); // 10 ETH product
const fee = await verificationManager.calculateVerificationFee(productValue);
console.log("Fee:", ethers.formatEther(fee)); // ~0.26 ETH

// Request verification
const tx = await verificationManager.requestVerification(
    productId,
    productValue,
    { value: fee }
);
const receipt = await tx.wait();

// Get request ID from event
const event = receipt.logs.find(log => 
    verificationManager.interface.parseLog(log).name === "VerificationRequested"
);
const requestId = event.args[0];
```

### Example 2: Verifier Workflow
```javascript
// Stake to become verifier
const minStake = await verificationManager.minStake();
await verificationManager.stakeAsVerifier({ value: minStake });

// Check verifier status
const isActive = await verificationManager.isActiveVerifier(verifierAddress);
console.log("Active verifier:", isActive);

// Assign to request
await verificationManager.connect(admin).assignVerifier(requestId, verifierAddress);

// Complete verification
await verificationManager.connect(verifier).completeVerification(
    requestId,
    true, // is authentic
    "ipfs://QmVerificationEvidence..."
);

// Check stats
const info = await verificationManager.getVerifierInfo(verifierAddress);
console.log("Total verifications:", info.totalVerifications);
console.log("Success rate:", info.successfulVerifications / info.totalVerifications);
```

### Example 3: Handle Timeout
```javascript
// Get request
const request = await verificationManager.getVerificationRequest(requestId);

// Check if timed out
if (Date.now() / 1000 > request.deadline && request.status === 1) {
    // Status 1 = InProgress
    await verificationManager.handleTimeout(requestId);
    
    // Verifier gets slashed
    // Requester gets refund
}
```

## Configuration Parameters

| Parameter | Default | Range | Purpose |
|-----------|---------|-------|---------|
| BASE_FEE | 0.01 ETH | 0-1 ETH | Minimum verification cost |
| feeRate | 250 (2.5%) | 0-1000 | Value-based fee percentage |
| minStake | 0.1 ETH | 0.01-10 ETH | Minimum verifier stake |
| slashPercentage | 10% | 1-50% | Penalty for timeout |
| verificationDeadline | 24 hours | 1-168 hours | Max verification time |

## Security Features

**Access Control**
- **VERIFIER_ROLE**: Assign verifiers, admin functions
- **DEFAULT_ADMIN_ROLE**: Configure parameters

**ReentrancyGuard**
- Protects fee payments
- Protects stake operations
- Prevents double distribution

**Pausable**
- Emergency stop for vulnerabilities
- Admin-controlled

**Stake Protection**
- Cannot unstake with pending verifications
- Slashing deters malicious behavior
- Minimum stake requirement

**Fee Safety**
- Exact fee validation on payment
- Refund on timeout
- Distribution verified by FeeDistributor

## Gas Costs

| Operation | Estimated Gas |
|-----------|---------------|
| Request Verification | ~200,000 |
| Assign Verifier | ~80,000 |
| Complete Verification | ~180,000 |
| Handle Timeout | ~120,000 |
| Stake | ~90,000 |
| Unstake | ~60,000 |

## Best Practices

**For Requesters:**
- Provide accurate product value for fair fee
- Monitor request status
- Handle timeout refunds

**For Verifiers:**
- Stake sufficient amount for credibility
- Complete verifications before deadline
- Provide detailed evidence URIs
- Maintain high success rate

**For Administrators:**
- Set reasonable fee rates
- Adjust stake requirements based on risk
- Monitor timeout rates
- Balance slash percentage

## Testing

**Test Coverage:** 31 tests
- Request creation
- Fee calculation
- Verifier staking
- Assignment and completion
- Timeout handling
- Slashing mechanism
- Fee distribution

Run tests:
```bash
npx hardhat test test/VerificationManager.test.js
```

## Contract Roles

**VERIFIER_ROLE**
- Assign verifiers to requests
- Admin verification functions

**DEFAULT_ADMIN_ROLE**
- Configure fees and parameters
- Pause/unpause contract
- Emergency controls

## Deployment

```javascript
const VerificationManager = await ethers.getContractFactory("VerificationManager");
const verificationManager = await VerificationManager.deploy(
    authTokenAddress,
    productRegistryAddress,
    feeDistributorAddress,
    retailerRegistryAddress
);
await verificationManager.waitForDeployment();

// Grant verifier role
await verificationManager.grantRole(VERIFIER_ROLE, adminAddress);
```

## Version

**Version:** 1.0.0  
**Solidity:** ^0.8.20  
**Dependencies:** AuthToken, ProductRegistry, FeeDistributor, RetailerRegistry

## License

MIT License

