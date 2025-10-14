# OracleIntegration Contract Documentation

## Overview

**OracleIntegration** manages external data feeds from IoT sensors and human verifiers using cryptographic signatures and weighted quorum consensus. It provides tamper-proof verification data aggregation for supply chain authenticity.

**Contract:** `contracts/OracleIntegration.sol`  
**Standard:** EIP712, AccessControl, Pausable  
**Purpose:** External data attestation and aggregation

## Purpose

The OracleIntegration contract provides:
- Cryptographically signed attestation submission
- Multi-source data aggregation with weighted voting
- Quorum-based consensus mechanism
- Trusted and permissionless source modes
- Finalized aggregate data for verification decisions

## Attestation Flow

```
1. Oracle signs data (EIP-712) → Off-chain
2. Submit attestation → On-chain
3. Aggregate with weights → Compute consensus
4. Reach quorum → Finalize result
5. Verification uses final value → Decision
```

## Core Data Structures

### Attestation
```solidity
struct Attestation {
    bytes32 productId;
    uint8 dataValue;        // 0-100 score
    uint256 timestamp;
    address source;
    bool isValid;
}
```

### Oracle Source
```solidity
struct OracleSource {
    address sourceAddress;
    uint256 weight;         // Voting weight (1-100)
    bool isTrusted;         // Trusted vs permissionless
    bool isActive;
    uint256 totalSubmissions;
    uint256 lastSubmissionAt;
}
```

### Aggregate Data
```solidity
struct AggregateData {
    uint256 weightedSum;
    uint256 totalWeight;
    uint256 submissionCount;
    bool isFinalized;
    uint8 finalValue;
}
```

## EIP-712 Typed Data

### Domain Separator
```solidity
EIP712("OracleIntegration", "1")
```

### Attestation Type Hash
```solidity
keccak256(
    "Attestation(bytes32 productId,uint8 dataValue,uint256 timestamp,address source)"
)
```

### Signing (Off-chain)
```javascript
const domain = {
    name: "OracleIntegration",
    version: "1",
    chainId: await ethers.provider.getNetwork().chainId,
    verifyingContract: oracleAddress
};

const types = {
    Attestation: [
        { name: "productId", type: "bytes32" },
        { name: "dataValue", type: "uint8" },
        { name: "timestamp", type: "uint256" },
        { name: "source", type: "address" }
    ]
};

const value = { productId, dataValue, timestamp, source };
const signature = await signer.signTypedData(domain, types, value);
```

## Aggregation Logic

### Weighted Average Calculation
```
weightedSum = Σ(dataValue × weight)
totalWeight = Σ(weight)
finalValue = weightedSum / totalWeight
```

**Example:**
- Oracle A (weight 50): 85/100
- Oracle B (weight 30): 90/100
- Oracle C (weight 20): 80/100
- **Final: (85×50 + 90×30 + 80×20) / 100 = 85.5**

### Quorum Requirements
```
Finalized when: totalWeight >= quorumThreshold

Default quorumThreshold = 60% of total possible weight
```

## Core Functions

### Attestation Submission

**submitAttestation(Attestation attestation, bytes signature)**
```solidity
function submitAttestation(
    Attestation calldata attestation,
    bytes calldata signature
) external whenNotPaused
```
Submits signed attestation. Verifies EIP-712 signature and source eligibility.

**submitTrustedAttestation(bytes32 productId, uint8 dataValue)**
```solidity
function submitTrustedAttestation(bytes32 productId, uint8 dataValue)
    external
    onlyRole(SUBMITTER_ROLE)
    whenNotPaused
```
Submits attestation from trusted source without signature.

### Finalization

**finalizeAggregation(bytes32 productId)**
```solidity
function finalizeAggregation(bytes32 productId)
    external
    returns (uint8)
```
Finalizes aggregate if quorum reached. Returns final consensus value.

### Source Management

**registerOracleSource(address source, uint256 weight, bool isTrusted)**
```solidity
function registerOracleSource(address source, uint256 weight, bool isTrusted)
    external
    onlyRole(ORACLE_ADMIN_ROLE)
```
Registers new oracle source with voting weight.

**updateSourceWeight(address source, uint256 newWeight)**
```solidity
function updateSourceWeight(address source, uint256 newWeight)
    external
    onlyRole(ORACLE_ADMIN_ROLE)
```
Updates oracle voting weight (1-100).

**deactivateSource(address source)**
```solidity
function deactivateSource(address source)
    external
    onlyRole(ORACLE_ADMIN_ROLE)
```
Deactivates oracle source.

### Configuration

**setQuorumThreshold(uint256 newThreshold)**
```solidity
function setQuorumThreshold(uint256 newThreshold)
    external
    onlyRole(ORACLE_ADMIN_ROLE)
```
Updates quorum percentage (1-100).

**setAttestationExpiry(uint256 expirySeconds)**
```solidity
function setAttestationExpiry(uint256 expirySeconds)
    external
    onlyRole(ORACLE_ADMIN_ROLE)
```
Sets maximum attestation age (default: 1 hour).

### View Functions

**getAggregateData(bytes32 productId)**
```solidity
function getAggregateData(bytes32 productId)
    external
    view
    returns (AggregateData memory)
```
Returns aggregation state for product.

**getFinalValue(bytes32 productId)**
```solidity
function getFinalValue(bytes32 productId)
    external
    view
    returns (uint8)
```
Returns finalized consensus value.

**isQuorumReached(bytes32 productId)**
```solidity
function isQuorumReached(bytes32 productId)
    external
    view
    returns (bool)
```
Checks if enough weight submitted for finalization.

**getOracleSource(address source)**
```solidity
function getOracleSource(address source)
    external
    view
    returns (OracleSource memory)
```
Returns oracle source information.

## Events

**AttestationSubmitted**
```solidity
event AttestationSubmitted(
    bytes32 indexed productId,
    address indexed source,
    uint8 dataValue,
    uint256 weight
);
```

**AggregationFinalized**
```solidity
event AggregationFinalized(
    bytes32 indexed productId,
    uint8 finalValue,
    uint256 totalWeight
);
```

**OracleSourceRegistered**
```solidity
event OracleSourceRegistered(
    address indexed source,
    uint256 weight,
    bool isTrusted
);
```

**SourceWeightUpdated**
```solidity
event SourceWeightUpdated(
    address indexed source,
    uint256 oldWeight,
    uint256 newWeight
);
```

**QuorumThresholdUpdated**
```solidity
event QuorumThresholdUpdated(
    uint256 newThreshold
);
```

## Oracle Source Types

### Trusted Sources
- Pre-approved and verified
- Higher default weights (50-100)
- Can submit without signature via SUBMITTER_ROLE
- Examples: Certified IoT devices, authorized inspectors

### Permissionless Sources
- Anyone can register
- Lower weights (1-30)
- Must use EIP-712 signatures
- Examples: Community verifiers, third-party sensors

## Integration

### With VerificationManager
```solidity
// Check oracle consensus before completing verification
uint8 oracleScore = oracleIntegration.getFinalValue(productId);
require(oracleScore >= AUTHENTICITY_THRESHOLD, "Oracle consensus: not authentic");
```

### With ProductRegistry
```solidity
// Record oracle attestation hash
bytes32 oracleHash = keccak256(abi.encode(productId, finalValue, timestamp));
productRegistry.recordVerification(productId, oracleHash);
```

## Usage Examples

### Example 1: Register Oracle Sources
```javascript
// Register trusted IoT sensor (high weight)
await oracleIntegration.connect(admin).registerOracleSource(
    iotSensorAddress,
    80, // High weight
    true // Trusted
);

// Register permissionless verifier (low weight)
await oracleIntegration.connect(admin).registerOracleSource(
    communityVerifierAddress,
    20, // Lower weight
    false // Not trusted
);
```

### Example 2: Submit Signed Attestation
```javascript
// Oracle creates attestation off-chain
const attestation = {
    productId: productIdBytes32,
    dataValue: 95, // 95/100 authenticity score
    timestamp: Math.floor(Date.now() / 1000),
    source: oracleAddress
};

// Sign with EIP-712
const domain = {
    name: "OracleIntegration",
    version: "1",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: await oracleIntegration.getAddress()
};

const types = {
    Attestation: [
        { name: "productId", type: "bytes32" },
        { name: "dataValue", type: "uint8" },
        { name: "timestamp", type: "uint256" },
        { name: "source", type: "address" }
    ]
};

const signature = await oracle.signTypedData(domain, types, attestation);

// Submit on-chain
await oracleIntegration.submitAttestation(attestation, signature);
```

### Example 3: Trusted Source Submission
```javascript
// Trusted source with SUBMITTER_ROLE
await oracleIntegration.connect(trustedOracle).submitTrustedAttestation(
    productId,
    90 // 90/100 score
);

// Check if quorum reached
const quorumReached = await oracleIntegration.isQuorumReached(productId);
if (quorumReached) {
    // Finalize to get consensus value
    const finalValue = await oracleIntegration.finalizeAggregation(productId);
    console.log("Consensus score:", finalValue);
}
```

### Example 4: Multi-Source Aggregation
```javascript
// Oracle A (weight 50, score 85)
await oracleIntegration.connect(oracleA).submitTrustedAttestation(productId, 85);

// Oracle B (weight 30, score 90)
await oracleIntegration.connect(oracleB).submitTrustedAttestation(productId, 90);

// Oracle C (weight 20, score 80)
await oracleIntegration.connect(oracleC).submitTrustedAttestation(productId, 80);

// Check aggregation
const data = await oracleIntegration.getAggregateData(productId);
console.log("Total weight:", data.totalWeight); // 100
console.log("Weighted sum:", data.weightedSum); // 8550
console.log("Is finalized:", data.isFinalized); // true
console.log("Final value:", data.finalValue); // 85.5 → 85
```

## Security Features

**EIP-712 Signatures**
- Prevents signature replay attacks
- Domain-specific signatures
- Type-safe data signing
- Signature verification on-chain

**Access Control**
- **ORACLE_ADMIN_ROLE**: Manage sources, configure parameters
- **SUBMITTER_ROLE**: Submit trusted attestations
- **DEFAULT_ADMIN_ROLE**: Grant roles, pause

**Attestation Validation**
- Timestamp expiry check
- Source active status check
- Duplicate submission prevention
- Data value range validation (0-100)

**Weighted Quorum**
- Prevents single-point manipulation
- Sybil resistance through weights
- Configurable threshold

**Pausable**
- Emergency stop capability
- Protects during vulnerabilities

## Configuration Parameters

| Parameter | Default | Range | Purpose |
|-----------|---------|-------|---------|
| quorumThreshold | 60% | 1-100% | Minimum weight for finalization |
| attestationExpiry | 3600s | 60-86400s | Maximum attestation age |
| maxDataValue | 100 | Fixed | Maximum score value |
| minWeight | 1 | Fixed | Minimum oracle weight |
| maxWeight | 100 | Fixed | Maximum oracle weight |

## Gas Costs

| Operation | Estimated Gas |
|-----------|---------------|
| Submit Signed Attestation | ~120,000 |
| Submit Trusted Attestation | ~95,000 |
| Finalize Aggregation | ~80,000 |
| Register Source | ~90,000 |
| View Functions | <10,000 |

## Best Practices

**For Oracle Operators:**
- Sign attestations immediately after observation
- Include recent timestamps
- Maintain consistent data quality
- Monitor source reputation

**For Administrators:**
- Assign weights based on reliability
- Trusted sources: 50-100 weight
- Permissionless: 1-30 weight
- Set quorum to 60-80% for security
- Monitor source performance

**For Integrators:**
- Always check `isFinalized` before using data
- Wait for quorum before making decisions
- Handle non-finalized states gracefully
- Monitor attestation expiry

## Testing

**Test Coverage:** 26 tests
- Source registration
- Signature verification
- Attestation submission
- Aggregation logic
- Quorum finalization
- Configuration
- Edge cases

Run tests:
```bash
npx hardhat test test/OracleIntegration.test.js
```

## Contract Roles

**ORACLE_ADMIN_ROLE**
- Register/deactivate sources
- Update weights
- Configure parameters
- Grant SUBMITTER_ROLE

**SUBMITTER_ROLE**
- Submit trusted attestations without signatures
- Typically granted to verified IoT devices

**DEFAULT_ADMIN_ROLE**
- Grant/revoke all roles
- Pause/unpause contract
- Emergency controls

## Deployment

```javascript
const OracleIntegration = await ethers.getContractFactory("OracleIntegration");
const oracleIntegration = await OracleIntegration.deploy();
await oracleIntegration.waitForDeployment();

// Configure
await oracleIntegration.setQuorumThreshold(60); // 60%
await oracleIntegration.setAttestationExpiry(3600); // 1 hour

// Register initial oracles
await oracleIntegration.registerOracleSource(trustedOracle, 80, true);
```

## Version

**Version:** 1.0.0  
**Solidity:** ^0.8.20  
**Standards:** EIP-712  
**Dependencies:** None

## License

MIT License

