# GovernanceVoting Contract Documentation

## Overview

**GovernanceVoting** implements token-weighted voting for protocol-level decisions. It enables AUTH token holders to propose and vote on system parameter changes, creating a decentralized governance mechanism.

**Contract:** `contracts/GovernanceVoting.sol`  
**Standard:** AccessControl, ReentrancyGuard  
**Purpose:** Decentralized protocol governance

## Purpose

The GovernanceVoting contract provides:
- Proposal creation for system changes
- Token-weighted voting power
- Quorum and approval threshold requirements
- Automated proposal execution
- Timelock mechanism for security

## Governance Flow

```
1. Create Proposal → Voting Period Starts
2. Token Holders Vote → For/Against/Abstain
3. Voting Period Ends → Tally Votes
4. If Passed → Queue for Execution
5. Timelock Expires → Execute Proposal
```

## Proposal Lifecycle

```
Pending → Active → [Succeeded/Defeated] → [Queued] → Executed
```

**ProposalState Enum:**
- **Pending**: Created, voting not started
- **Active**: Voting period ongoing
- **Succeeded**: Passed quorum and approval thresholds
- **Defeated**: Failed to meet requirements
- **Queued**: Awaiting timelock expiry
- **Executed**: Successfully implemented
- **Canceled**: Canceled by proposer

## Core Data Structures

### Proposal
```solidity
struct Proposal {
    uint256 id;
    address proposer;
    string description;
    uint256 forVotes;
    uint256 againstVotes;
    uint256 abstainVotes;
    uint256 startTime;
    uint256 endTime;
    uint256 eta;              // Execution timestamp
    bool executed;
    bool canceled;
    bytes32 targetHash;       // Hash of target contract
    bytes callData;           // Encoded function call
}
```

### Vote Receipt
```solidity
struct Receipt {
    bool hasVoted;
    uint8 support;            // 0=Against, 1=For, 2=Abstain
    uint256 votes;            // Vote weight (token balance)
}

mapping(uint256 => mapping(address => Receipt)) public receipts;
```

## Voting Parameters

### Default Configuration
```solidity
uint256 public votingPeriod = 3 days;
uint256 public votingDelay = 1 days;
uint256 public proposalThreshold = 100_000 * 10**18; // 100k AUTH
uint256 public quorumPercentage = 10;                // 10% of supply
uint256 public approvalThreshold = 50;               // 50% for/against
uint256 public timelockPeriod = 2 days;
```

### Thresholds Explained

**Proposal Threshold**
- Minimum AUTH tokens to create proposal
- Prevents spam proposals
- Default: 100,000 AUTH (0.01% of 1B supply)

**Quorum**
- Minimum participation required
- Percentage of total supply
- Default: 10% (100M AUTH must vote)

**Approval Threshold**
- Percentage of FOR votes needed
- Calculated from FOR + AGAINST (excludes ABSTAIN)
- Default: 50% (simple majority)

**Timelock**
- Delay between passage and execution
- Security measure for community review
- Default: 2 days

## Vote Weight Calculation

```
votingPower = authToken.balanceOf(voter) at proposal creation block
```

**Features:**
- Snapshot at proposal creation
- Prevents vote manipulation via token transfers
- 1 token = 1 vote weight

## Core Functions

### Proposal Management

**propose(string description, address target, bytes callData)**
```solidity
function propose(
    string calldata description,
    address target,
    bytes calldata callData
) external returns (uint256)
```
Creates new governance proposal. Requires minimum token balance.

**Parameters:**
- `description`: Human-readable proposal description
- `target`: Contract to call if executed
- `callData`: Encoded function call data

**Returns:**
- `uint256`: Unique proposal ID

**cancel(uint256 proposalId)**
```solidity
function cancel(uint256 proposalId) external
```
Cancels proposal. Only proposer or admin can cancel.

### Voting

**castVote(uint256 proposalId, uint8 support)**
```solidity
function castVote(uint256 proposalId, uint8 support) external
```
Casts vote with caller's token weight.

**Support Values:**
- `0`: Against
- `1`: For
- `2`: Abstain

**castVoteWithReason(uint256 proposalId, uint8 support, string reason)**
```solidity
function castVoteWithReason(
    uint256 proposalId,
    uint8 support,
    string calldata reason
) external
```
Casts vote with explanation.

### Execution

**queue(uint256 proposalId)**
```solidity
function queue(uint256 proposalId) external
```
Queues succeeded proposal for execution after timelock.

**execute(uint256 proposalId)**
```solidity
function execute(uint256 proposalId) external nonReentrant
```
Executes queued proposal after timelock expiry.

### Configuration

**setVotingPeriod(uint256 newPeriod)**
**setVotingDelay(uint256 newDelay)**
**setProposalThreshold(uint256 newThreshold)**
**setQuorumPercentage(uint256 newPercentage)**
**setApprovalThreshold(uint256 newThreshold)**
**setTimelockPeriod(uint256 newPeriod)**

Admin functions to update governance parameters.

### View Functions

**getProposal(uint256 proposalId)**
```solidity
function getProposal(uint256 proposalId)
    external
    view
    returns (Proposal memory)
```

**state(uint256 proposalId)**
```solidity
function state(uint256 proposalId)
    external
    view
    returns (ProposalState)
```
Returns current proposal state.

**getReceipt(uint256 proposalId, address voter)**
```solidity
function getReceipt(uint256 proposalId, address voter)
    external
    view
    returns (Receipt memory)
```

**getVotes(address account)**
```solidity
function getVotes(address account)
    public
    view
    returns (uint256)
```
Returns current voting power.

**hasVoted(uint256 proposalId, address voter)**
```solidity
function hasVoted(uint256 proposalId, address voter)
    external
    view
    returns (bool)
```

## Proposal Success Criteria

A proposal succeeds if:
```
1. Quorum reached: (forVotes + againstVotes + abstainVotes) >= quorum
2. Approval met: forVotes / (forVotes + againstVotes) >= approvalThreshold
3. Voting period ended
```

**Example (10% quorum, 50% approval):**
```
Total Supply: 1,000,000,000 AUTH
Quorum: 100,000,000 AUTH (10%)

Scenario 1: PASS
For: 60M, Against: 40M, Abstain: 10M
Total: 110M (>100M quorum ✓)
Approval: 60/(60+40) = 60% (>50% ✓)
Result: SUCCEEDED

Scenario 2: FAIL (No Quorum)
For: 55M, Against: 30M, Abstain: 5M
Total: 90M (<100M quorum ✗)
Result: DEFEATED

Scenario 3: FAIL (No Approval)
For: 40M, Against: 65M, Abstain: 10M
Total: 115M (>100M quorum ✓)
Approval: 40/(40+65) = 38% (<50% ✗)
Result: DEFEATED
```

## Events

**ProposalCreated**
```solidity
event ProposalCreated(
    uint256 indexed proposalId,
    address indexed proposer,
    string description,
    uint256 startTime,
    uint256 endTime
);
```

**VoteCast**
```solidity
event VoteCast(
    address indexed voter,
    uint256 indexed proposalId,
    uint8 support,
    uint256 votes,
    string reason
);
```

**ProposalQueued**
```solidity
event ProposalQueued(
    uint256 indexed proposalId,
    uint256 eta
);
```

**ProposalExecuted**
```solidity
event ProposalExecuted(
    uint256 indexed proposalId
);
```

**ProposalCanceled**
```solidity
event ProposalCanceled(
    uint256 indexed proposalId
);
```

## Integration

### With AuthToken
```solidity
// Check voting power
uint256 power = authToken.balanceOf(voter);

// Proposal threshold check
require(
    authToken.balanceOf(proposer) >= proposalThreshold,
    "Insufficient tokens"
);
```

### Target Contracts
Any contract with governance-controlled functions:
```solidity
// Example: Update fee in VerificationManager
bytes memory callData = abi.encodeWithSignature(
    "setBaseFee(uint256)",
    newFeeAmount
);

governanceVoting.propose(
    "Update verification base fee to 0.02 ETH",
    verificationManagerAddress,
    callData
);
```

## Usage Examples

### Example 1: Create Proposal
```javascript
// Check proposer has enough tokens
const balance = await authToken.balanceOf(proposerAddress);
const threshold = await governanceVoting.proposalThreshold();
console.log("Has threshold:", balance >= threshold);

// Encode function call to update fee
const newFee = ethers.parseEther("0.02");
const callData = verificationManager.interface.encodeFunctionData(
    "setBaseFee",
    [newFee]
);

// Create proposal
const tx = await governanceVoting.connect(proposer).propose(
    "Proposal: Increase base verification fee to 0.02 ETH to match market rates",
    await verificationManager.getAddress(),
    callData
);

const receipt = await tx.wait();
const proposalId = receipt.logs[0].args[0];
console.log("Proposal ID:", proposalId);
```

### Example 2: Vote on Proposal
```javascript
// Check voting power
const votes = await governanceVoting.getVotes(voterAddress);
console.log("Voting power:", ethers.formatEther(votes), "AUTH");

// Cast vote FOR with reason
await governanceVoting.connect(voter).castVoteWithReason(
    proposalId,
    1, // FOR
    "Fee increase needed to sustain verifier network"
);

// Check vote receipt
const receipt = await governanceVoting.getReceipt(proposalId, voterAddress);
console.log("Voted:", receipt.hasVoted);
console.log("Support:", receipt.support === 1 ? "FOR" : "AGAINST");
console.log("Weight:", ethers.formatEther(receipt.votes));
```

### Example 3: Execute Proposal
```javascript
// Check proposal state
let currentState = await governanceVoting.state(proposalId);
console.log("State:", currentState); // 0=Pending, 1=Active, 2=Succeeded...

// Wait for voting period to end
// ... time passes ...

currentState = await governanceVoting.state(proposalId);
if (currentState === 2) { // Succeeded
    // Queue for execution
    await governanceVoting.queue(proposalId);
    
    const proposal = await governanceVoting.getProposal(proposalId);
    console.log("ETA:", new Date(proposal.eta * 1000));
    
    // Wait for timelock
    // ... 2 days pass ...
    
    // Execute
    await governanceVoting.execute(proposalId);
    console.log("Proposal executed! Fee updated.");
}
```

### Example 4: Monitor Proposal Progress
```javascript
const proposal = await governanceVoting.getProposal(proposalId);

console.log("FOR votes:", ethers.formatEther(proposal.forVotes));
console.log("AGAINST votes:", ethers.formatEther(proposal.againstVotes));
console.log("ABSTAIN votes:", ethers.formatEther(proposal.abstainVotes));

const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
const totalSupply = await authToken.totalSupply();
const quorumNeeded = await governanceVoting.quorumPercentage();

const participation = (totalVotes * 100n) / totalSupply;
console.log("Participation:", participation.toString(), "%");
console.log("Quorum needed:", quorumNeeded.toString(), "%");
console.log("Quorum met:", participation >= quorumNeeded);

if (proposal.forVotes + proposal.againstVotes > 0) {
    const approval = (proposal.forVotes * 100n) / (proposal.forVotes + proposal.againstVotes);
    console.log("Approval:", approval.toString(), "%");
}
```

## Common Proposal Types

### 1. Parameter Updates
```javascript
// Update verification fee
const callData = verificationManager.interface.encodeFunctionData(
    "setBaseFee",
    [newFee]
);
```

### 2. Treasury Management
```javascript
// Transfer treasury funds
const callData = feeDistributor.interface.encodeFunctionData(
    "claimRewardsFor",
    [recipientAddress]
);
```

### 3. Role Grants
```javascript
// Grant verifier role
const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
const callData = verificationManager.interface.encodeFunctionData(
    "grantRole",
    [VERIFIER_ROLE, newVerifierAddress]
);
```

### 4. Configuration Changes
```javascript
// Update reputation weights
const newWeights = { /* ... */ };
const callData = retailerRegistry.interface.encodeFunctionData(
    "updateReputationWeights",
    [newWeights]
);
```

## Security Features

**Access Control**
- **PROPOSER_ROLE**: Override proposal threshold (optional)
- **DEFAULT_ADMIN_ROLE**: Cancel proposals, update parameters

**Timelock**
- Delays execution after passage
- Community can react to malicious proposals
- Emergency cancel mechanism

**Token Snapshot**
- Voting power fixed at proposal creation
- Prevents vote manipulation
- No flash loan attacks

**ReentrancyGuard**
- Protects execution
- Prevents reentrancy exploits

**Proposal Validation**
- Checks target contract exists
- Validates call data format
- Prevents zero-address execution

## Gas Costs

| Operation | Estimated Gas |
|-----------|---------------|
| Create Proposal | ~150,000 |
| Cast Vote | ~80,000 |
| Queue Proposal | ~60,000 |
| Execute Proposal | ~100,000+ (varies) |
| View Functions | <10,000 |

## Best Practices

**For Token Holders:**
- Participate in all relevant proposals
- Provide reasoning with votes
- Monitor proposal execution
- Stay informed on governance

**For Proposers:**
- Write clear descriptions
- Test call data thoroughly
- Engage community before proposing
- Maintain proposal threshold

**For Administrators:**
- Set reasonable thresholds
- Monitor proposal quality
- Only cancel malicious proposals
- Adjust parameters based on participation

## Testing

**Test Coverage:** 19 tests
- Proposal creation
- Voting mechanics
- Quorum and approval
- Execution flow
- Configuration
- Edge cases

Run tests:
```bash
npx hardhat test test/GovernanceVoting.test.js
```

## Contract Roles

**PROPOSER_ROLE**
- Bypass proposal threshold
- Create proposals with less tokens

**DEFAULT_ADMIN_ROLE**
- Update governance parameters
- Cancel proposals
- Grant roles

## Deployment

```javascript
const GovernanceVoting = await ethers.getContractFactory("GovernanceVoting");
const governanceVoting = await GovernanceVoting.deploy(authTokenAddress);
await governanceVoting.waitForDeployment();

// Optional: Customize parameters
await governanceVoting.setQuorumPercentage(15); // 15%
await governanceVoting.setVotingPeriod(7 * 24 * 3600); // 7 days
```

## Version

**Version:** 1.0.0  
**Solidity:** ^0.8.20  
**Governance:** Token-weighted voting  
**Dependencies:** AuthToken

## License

MIT License

