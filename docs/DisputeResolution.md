# DisputeResolution Contract Documentation

## Overview

**DisputeResolution** handles contested product verifications through a decentralized arbiter voting system. It provides a fair mechanism for resolving authenticity disputes with evidence submission, stake-based arbitration, and financial incentives.

**Contract:** `contracts/DisputeResolution.sol`  
**Standard:** AccessControl, ReentrancyGuard, Pausable  
**Purpose:** Dispute arbitration and resolution

## Purpose

The DisputeResolution contract provides:
- Dispute creation with refundable bond
- Evidence submission from both parties
- Multi-arbiter voting system
- Quorum-based decision making
- Winner reward distribution
- Integration with verification and reputation systems

## Dispute Lifecycle

```
1. Raise Dispute (with bond) → Open
2. Submit Evidence → Both parties
3. Arbiters Vote → For/Against
4. Quorum Reached → Resolved
5. Distribute Rewards → Winner + Arbiters
6. Update Reputation → Parties
```

**DisputeStatus Enum:**
- **Open**: Active, collecting evidence and votes
- **Resolved**: Decision reached, winner determined
- **Expired**: Timeout without resolution

## Core Data Structures

### Dispute
```solidity
struct Dispute {
    bytes32 disputeId;
    bytes32 requestId;          // Related verification request
    address challenger;         // Party raising dispute
    address defendant;          // Party being challenged
    uint256 bondAmount;         // Challenger's stake
    uint256 createdAt;
    uint256 deadline;
    DisputeStatus status;
    bool challengerWon;
    string challengerEvidence;
    string defendantEvidence;
    uint256 votesFor;           // Votes for challenger
    uint256 votesAgainst;       // Votes for defendant
}
```

### Arbiter Info
```solidity
struct ArbiterInfo {
    bool isActive;
    uint256 totalDisputes;
    uint256 correctVotes;
    uint256 reputationScore;
    uint256 stakedAmount;
}

mapping(bytes32 => mapping(address => bool)) public arbiterVotes;
mapping(bytes32 => mapping(address => bool)) public hasVoted;
```

## Bond and Reward System

### Dispute Bond
```
Default: 0.1 ETH (refundable if winner)
Purpose: Prevent frivolous disputes
```

### Reward Distribution (Winner Side)
```
Total Pool = challengerBond + defendantBond (if they stake)

Winner receives: bondAmount (refund)
Arbiters who voted correctly: share bond from loser
```

**Example:**
```
Challenger bond: 0.1 ETH
5 Arbiters vote (3 for challenger, 2 for defendant)
Challenger wins

Distribution:
├─ Challenger: 0.1 ETH (refund)
├─ 3 Correct Arbiters: split from reward pool
└─ 2 Incorrect Arbiters: no reward
```

## Core Functions

### Dispute Management

**raiseDispute(bytes32 requestId, string evidence)**
```solidity
function raiseDispute(bytes32 requestId, string calldata evidence)
    external
    payable
    nonReentrant
    whenNotPaused
    returns (bytes32)
```
Creates new dispute. Requires bond payment.

**Parameters:**
- `requestId`: Verification request being disputed
- `evidence`: IPFS URI or description

**Returns:**
- `bytes32`: Unique dispute ID

**submitEvidence(bytes32 disputeId, string evidence)**
```solidity
function submitEvidence(bytes32 disputeId, string calldata evidence)
    external
```
Defendant submits counter-evidence.

**cancelDispute(bytes32 disputeId)**
```solidity
function cancelDispute(bytes32 disputeId)
    external
    nonReentrant
```
Challenger can cancel before voting begins (full refund).

### Arbiter Operations

**registerArbiter()**
```solidity
function registerArbiter()
    external
    payable
    nonReentrant
```
Registers as arbiter. Requires minimum stake (0.05 ETH default).

**voteOnDispute(bytes32 disputeId, bool voteForChallenger)**
```solidity
function voteOnDispute(bytes32 disputeId, bool voteForChallenger)
    external
    onlyRole(ARBITER_ROLE)
    nonReentrant
```
Arbiter casts vote.

**Parameters:**
- `voteForChallenger`: `true` for challenger, `false` for defendant

**claimArbiterReward(bytes32 disputeId)**
```solidity
function claimArbiterReward(bytes32 disputeId)
    external
    nonReentrant
```
Claims reward for correct vote after resolution.

### Resolution

**resolveDispute(bytes32 disputeId)**
```solidity
function resolveDispute(bytes32 disputeId)
    external
    nonReentrant
    returns (bool)
```
Resolves dispute if quorum reached. Returns winner.

**handleExpiredDispute(bytes32 disputeId)**
```solidity
function handleExpiredDispute(bytes32 disputeId)
    external
    nonReentrant
```
Handles disputes past deadline without resolution.

### Configuration

**setDisputeBond(uint256 newBond)**
```solidity
function setDisputeBond(uint256 newBond)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
```
Updates required dispute bond.

**setMinArbiterStake(uint256 newStake)**
```solidity
function setMinArbiterStake(uint256 newStake)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
```
Updates minimum arbiter stake.

**setQuorumThreshold(uint256 newThreshold)**
```solidity
function setQuorumThreshold(uint256 newThreshold)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
```
Updates minimum arbiter votes needed (default: 3).

**setDisputePeriod(uint256 newPeriod)**
```solidity
function setDisputePeriod(uint256 newPeriod)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
```
Updates resolution deadline (default: 7 days).

### View Functions

**getDispute(bytes32 disputeId)**
```solidity
function getDispute(bytes32 disputeId)
    external
    view
    returns (Dispute memory)
```

**getArbiterInfo(address arbiter)**
```solidity
function getArbiterInfo(address arbiter)
    external
    view
    returns (ArbiterInfo memory)
```

**hasArbiterVoted(bytes32 disputeId, address arbiter)**
```solidity
function hasArbiterVoted(bytes32 disputeId, address arbiter)
    external
    view
    returns (bool)
```

**getVoteCount(bytes32 disputeId)**
```solidity
function getVoteCount(bytes32 disputeId)
    external
    view
    returns (uint256 forVotes, uint256 againstVotes)
```

## Resolution Logic

### Quorum Requirements
```
Quorum threshold: 3 arbiters (default)
Decision: Simple majority of votes
```

### Winner Determination
```
if (votesFor > votesAgainst):
    challengerWon = true
    winner = challenger
else:
    challengerWon = false
    winner = defendant
```

### Resolution Examples

**Scenario 1: Clear Challenger Victory**
```
Votes FOR challenger: 4
Votes AGAINST challenger: 1
Total votes: 5 (≥3 quorum ✓)
Majority: 4 > 1 ✓
Result: Challenger wins
```

**Scenario 2: Defendant Victory**
```
Votes FOR challenger: 2
Votes AGAINST challenger: 5
Total votes: 7 (≥3 quorum ✓)
Majority: 2 < 5
Result: Defendant wins
```

**Scenario 3: No Quorum**
```
Votes FOR: 1
Votes AGAINST: 1
Total: 2 (<3 quorum ✗)
Result: Cannot resolve yet
```

## Events

**DisputeRaised**
```solidity
event DisputeRaised(
    bytes32 indexed disputeId,
    bytes32 indexed requestId,
    address indexed challenger,
    address defendant,
    uint256 bondAmount
);
```

**EvidenceSubmitted**
```solidity
event EvidenceSubmitted(
    bytes32 indexed disputeId,
    address indexed submitter,
    string evidenceURI
);
```

**ArbiterVoted**
```solidity
event ArbiterVoted(
    bytes32 indexed disputeId,
    address indexed arbiter,
    bool voteForChallenger
);
```

**DisputeResolved**
```solidity
event DisputeResolved(
    bytes32 indexed disputeId,
    bool challengerWon,
    uint256 votesFor,
    uint256 votesAgainst
);
```

**ArbiterRewardClaimed**
```solidity
event ArbiterRewardClaimed(
    bytes32 indexed disputeId,
    address indexed arbiter,
    uint256 reward
);
```

**DisputeCanceled**
```solidity
event DisputeCanceled(
    bytes32 indexed disputeId
);
```

## Integration

### With VerificationManager
```solidity
// Get verification request details
VerificationRequest memory request = verificationManager.getVerificationRequest(requestId);

// Update verification status after dispute
if (challengerWon) {
    // Verification was incorrect
    verificationManager.handleDisputedVerification(requestId);
}
```

### With RetailerRegistry
```solidity
// Update reputation based on dispute outcome
if (challengerWon) {
    retailerRegistry.recordDispute(defendant, false); // Defendant lost
    retailerRegistry.recordDispute(challenger, true);  // Challenger won
} else {
    retailerRegistry.recordDispute(challenger, false);
    retailerRegistry.recordDispute(defendant, true);
}
```

### With ProductRegistry
```solidity
// Update product status if dispute changes authenticity
if (challengerWon) {
    productRegistry.updateProductStatus(productId, ProductStatus.Disputed);
}
```

## Usage Examples

### Example 1: Raise Dispute
```javascript
// Prepare evidence (IPFS link or description)
const evidence = "ipfs://QmEvidenceHash - Product verification was incorrect. " +
                 "Serial number mismatch detected.";

// Get required bond
const bond = await disputeResolution.disputeBond();
console.log("Bond required:", ethers.formatEther(bond));

// Raise dispute
const tx = await disputeResolution.connect(challenger).raiseDispute(
    requestId,
    evidence,
    { value: bond }
);

const receipt = await tx.wait();
const disputeId = receipt.logs[0].args[0];
console.log("Dispute ID:", disputeId);
```

### Example 2: Submit Counter-Evidence
```javascript
// Defendant responds with evidence
const counterEvidence = "ipfs://QmCounterEvidence - Verification was correct. " +
                       "Here is proof of authenticity.";

await disputeResolution.connect(defendant).submitEvidence(
    disputeId,
    counterEvidence
);
```

### Example 3: Arbiter Voting
```javascript
// Register as arbiter
const minStake = await disputeResolution.minArbiterStake();
await disputeResolution.connect(arbiter).registerArbiter({ value: minStake });

// Review evidence
const dispute = await disputeResolution.getDispute(disputeId);
console.log("Challenger evidence:", dispute.challengerEvidence);
console.log("Defendant evidence:", dispute.defendantEvidence);

// Vote (after reviewing evidence off-chain)
await disputeResolution.connect(arbiter).voteOnDispute(
    disputeId,
    true // Vote for challenger
);

// Check vote count
const [forVotes, againstVotes] = await disputeResolution.getVoteCount(disputeId);
console.log("Votes FOR challenger:", forVotes);
console.log("Votes AGAINST challenger:", againstVotes);
```

### Example 4: Resolve and Claim Rewards
```javascript
// Check if quorum reached
const dispute = await disputeResolution.getDispute(disputeId);
const quorum = await disputeResolution.quorumThreshold();

if (dispute.votesFor + dispute.votesAgainst >= quorum) {
    // Resolve dispute
    const tx = await disputeResolution.resolveDispute(disputeId);
    const receipt = await tx.wait();
    
    const resolved = await disputeResolution.getDispute(disputeId);
    console.log("Winner:", resolved.challengerWon ? "Challenger" : "Defendant");
    
    // Arbiters claim rewards
    if (arbiterVotedCorrectly) {
        await disputeResolution.connect(arbiter).claimArbiterReward(disputeId);
        console.log("Arbiter reward claimed");
    }
}
```

### Example 5: Monitor Arbiter Performance
```javascript
const arbiterInfo = await disputeResolution.getArbiterInfo(arbiterAddress);

console.log("Total disputes participated:", arbiterInfo.totalDisputes);
console.log("Correct votes:", arbiterInfo.correctVotes);
console.log("Accuracy:", (arbiterInfo.correctVotes / arbiterInfo.totalDisputes * 100).toFixed(2), "%");
console.log("Reputation score:", arbiterInfo.reputationScore);
console.log("Staked amount:", ethers.formatEther(arbiterInfo.stakedAmount));
```

## Arbiter Reputation System

### Reputation Calculation
```
reputation = (correctVotes / totalDisputes) × 100

High reputation (>80%): Trusted arbiter
Medium reputation (60-80%): Reliable
Low reputation (<60%): Questionable
```

### Reputation Impact
- Higher reputation → Increased community trust
- Potential for weighted voting in future versions
- May influence arbiter selection

## Financial Flows

### Dispute Bond Flow
```
1. Challenger stakes 0.1 ETH
2. Voting occurs
3. Resolution:
   
   IF Challenger Wins:
   ├─ Challenger: 0.1 ETH refund
   └─ Correct Arbiters: Share reward pool
   
   IF Defendant Wins:
   ├─ Defendant: Receives challenger's bond
   └─ Correct Arbiters: Share reward pool
```

### Arbiter Reward Calculation
```
totalRewardPool = loserBond × arbiterRewardPercent
arbiterReward = totalRewardPool / correctArbiterCount
```

**Example:**
```
Bond: 0.1 ETH
Arbiter reward pool: 0.05 ETH (50%)
Correct arbiters: 3
Each arbiter receives: 0.05 / 3 = 0.0166 ETH
```

## Security Features

**Access Control**
- **ARBITER_ROLE**: Vote on disputes
- **DEFAULT_ADMIN_ROLE**: Configure parameters

**Bond Mechanism**
- Prevents spam disputes
- Financial stake ensures seriousness
- Refundable for winners

**ReentrancyGuard**
- Protects reward claims
- Prevents reentrancy exploits

**Vote Privacy**
- Can implement commit-reveal in v2
- Current: Public votes for transparency

**Deadline Enforcement**
- Disputes cannot stay open indefinitely
- Automatic expiry handling

**Pausable**
- Emergency stop capability
- Admin-controlled

## Gas Costs

| Operation | Estimated Gas |
|-----------|---------------|
| Raise Dispute | ~180,000 |
| Submit Evidence | ~70,000 |
| Vote | ~95,000 |
| Resolve Dispute | ~150,000 |
| Claim Reward | ~60,000 |
| Register Arbiter | ~90,000 |

## Best Practices

**For Challengers:**
- Provide detailed evidence with IPFS links
- Only dispute if confident (bond at risk)
- Submit evidence promptly
- Monitor voting progress

**For Defendants:**
- Respond quickly with counter-evidence
- Provide comprehensive proof
- Stay engaged in process

**For Arbiters:**
- Review all evidence thoroughly
- Vote based on facts, not bias
- Maintain high accuracy for reputation
- Stake sufficient amount for credibility

**For Administrators:**
- Set reasonable bond amounts
- Adjust quorum based on arbiter pool size
- Monitor arbiter quality
- Balance reward percentages

## Testing

**Test Coverage:** 21 tests
- Dispute creation
- Evidence submission
- Arbiter voting
- Resolution logic
- Reward distribution
- Expiry handling
- Edge cases

Run tests:
```bash
npx hardhat test test/DisputeResolution.test.js
```

## Configuration Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| disputeBond | 0.1 ETH | Required stake to raise dispute |
| minArbiterStake | 0.05 ETH | Minimum arbiter stake |
| quorumThreshold | 3 votes | Minimum votes to resolve |
| disputePeriod | 7 days | Deadline for resolution |
| arbiterRewardPercent | 50% | Portion of bond for arbiters |

## Contract Roles

**ARBITER_ROLE**
- Vote on disputes
- Claim arbiter rewards
- Must stake minimum amount

**DEFAULT_ADMIN_ROLE**
- Configure parameters
- Grant/revoke arbiter role
- Pause/unpause contract
- Handle edge cases

## Deployment

```javascript
const DisputeResolution = await ethers.getContractFactory("DisputeResolution");
const disputeResolution = await DisputeResolution.deploy(
    verificationManagerAddress,
    retailerRegistryAddress,
    productRegistryAddress
);
await disputeResolution.waitForDeployment();

// Configure
await disputeResolution.setQuorumThreshold(3);
await disputeResolution.setDisputeBond(ethers.parseEther("0.1"));

// Register initial arbiters
await disputeResolution.grantRole(ARBITER_ROLE, arbiterAddress);
```

## Version

**Version:** 1.0.0  
**Solidity:** ^0.8.20  
**Dispute Model:** Multi-arbiter voting  
**Dependencies:** VerificationManager, RetailerRegistry, ProductRegistry

## License

MIT License

