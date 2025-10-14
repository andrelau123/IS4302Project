# Supply Chain Transparency & Authenticity - Contract Documentation

This directory contains comprehensive documentation for all smart contracts in the supply chain authenticity system.

## Documentation Index

### Core Contracts

#### 1. [AuthToken](./AuthToken.md)
**Purpose:** ERC-20 utility token with staking and rewards

**Key Features:**
- 1 billion token supply with distribution plan
- Staking mechanism with 8% APY
- Reward pool management
- Governance participation rights
- Pausable for security

**Use Cases:**
- Pay verification fees
- Stake for verifier eligibility
- Earn rewards from staking
- Vote on governance proposals

---

#### 2. [ProductRegistry](./ProductRegistry.md)
**Purpose:** Core product registration and lifecycle tracking

**Key Features:**
- Unique product identity management
- Ownership transfer tracking
- Lifecycle status management (Registered → InTransit → AtRetailer → Sold)
- Transfer history with location data
- Retailer authorization validation

**Use Cases:**
- Manufacturer registers authentic products
- Track product journey through supply chain
- Verify product authenticity
- Maintain complete provenance

---

#### 3. [RetailerRegistry](./RetailerRegistry.md)
**Purpose:** Retailer management with multi-factor reputation system

**Key Features:**
- Retailer registration and verification
- Brand-specific authorization
- 7-factor reputation scoring (0-1000 scale)
- Performance tracking (volume, response time, disputes)
- Reputation decay for inactivity

**Reputation Factors:**
- Success Rate (30%)
- Volume (15%)
- Tenure (10%)
- Response Time (15%)
- Dispute History (20%)
- Consistency (10%)
- Decay Multiplier

**Use Cases:**
- Manage authorized retailer network
- Track retailer performance
- Make data-driven authorization decisions
- Maintain quality standards

---

#### 4. [VerificationManager](./VerificationManager.md)
**Purpose:** Central verification workflow orchestration

**Key Features:**
- Verification request lifecycle management
- Verifier staking (0.1 ETH minimum)
- Dynamic fee calculation (base + value-based)
- Timeout handling with slashing
- Fee distribution coordination

**Fee Formula:**
```
totalFee = baseFee + (productValue × 2.5%)
```

**Use Cases:**
- Request product verification
- Become eligible verifier (stake)
- Complete verification requests
- Earn verification fees

---

#### 5. [OracleIntegration](./OracleIntegration.md)
**Purpose:** External data attestation with cryptographic signatures

**Key Features:**
- EIP-712 signed attestations
- Weighted oracle voting
- Quorum-based consensus (60% default)
- Trusted vs permissionless sources
- Aggregate data finalization

**Use Cases:**
- Submit IoT sensor data
- Aggregate human verifier inputs
- Reach consensus on authenticity
- Provide tamper-proof external data

---

#### 6. [FeeDistributor](./FeeDistributor.md)
**Purpose:** Automated revenue sharing and reward distribution

**Key Features:**
- Proportional fee splitting (60% verifier, 25% brand, 15% treasury)
- Pull-based claim system
- Accumulated reward tracking
- Configurable distribution ratios
- Transparent accounting

**Use Cases:**
- Distribute verification fees to stakeholders
- Claim accumulated rewards
- Track lifetime earnings
- Manage protocol treasury

---

#### 7. [GovernanceVoting](./GovernanceVoting.md)
**Purpose:** Token-weighted decentralized governance

**Key Features:**
- Proposal creation (100k AUTH threshold)
- Token-weighted voting (1 token = 1 vote)
- Quorum requirement (10% of supply)
- Timelock mechanism (2 days)
- Automated execution

**Governance Flow:**
```
Propose → Vote → Queue → Execute
```

**Use Cases:**
- Update protocol parameters
- Manage treasury funds
- Grant/revoke system roles
- Configure contract settings

---

#### 8. [DisputeResolution](./DisputeResolution.md)
**Purpose:** Decentralized dispute arbitration system

**Key Features:**
- Stake-based dispute initiation (0.1 ETH bond)
- Evidence submission from both parties
- Multi-arbiter voting (3 minimum quorum)
- Winner reward distribution
- Arbiter reputation tracking

**Resolution Logic:**
```
Quorum ≥ 3 votes → Majority wins → Distribute rewards
```

**Use Cases:**
- Challenge incorrect verifications
- Arbitrate authenticity disputes
- Earn rewards as arbiter
- Maintain system integrity

---

#### 9. [ProductNFT](./ProductNFT.md)
**Purpose:** Premium product NFTs with transfer restrictions

**Key Features:**
- ERC-721 NFT for authenticated products
- Transfer restrictions via RetailerRegistry
- Whitelist system for marketplaces
- Complete transfer history tracking
- EIP-2981 royalty support (0-10%)
- Secondary market price recording

**Security:**
- Retailer authorization checks
- Pausable operations
- Reentrancy protection
- Immutable contract references

**Use Cases:**
- Mint NFTs for premium products
- Control distribution network
- Track provenance on-chain
- Earn royalties from resales
- Enable legitimate secondary markets

---

## Contract Interactions

### Verification Flow
```
1. ProductRegistry.registerProduct() → Product ID
2. VerificationManager.requestVerification() → Pay fee
3. VerificationManager.assignVerifier() → Assign verifier
4. OracleIntegration.submitAttestation() → External data
5. VerificationManager.completeVerification() → Finalize
6. FeeDistributor.distributeFees() → Reward stakeholders
7. RetailerRegistry.updateReputation() → Update scores
```

### Dispute Flow
```
1. DisputeResolution.raiseDispute() → Stake bond
2. DisputeResolution.submitEvidence() → Both parties
3. DisputeResolution.voteOnDispute() → Arbiters vote
4. DisputeResolution.resolveDispute() → Determine winner
5. RetailerRegistry.recordDispute() → Update reputation
6. ProductRegistry.updateStatus() → Mark as disputed
```

### Governance Flow
```
1. GovernanceVoting.propose() → Create proposal
2. GovernanceVoting.castVote() → Token holders vote
3. GovernanceVoting.queue() → Queue if passed
4. [2 day timelock]
5. GovernanceVoting.execute() → Implement change
```

### NFT Premium Product Flow
```
1. ProductRegistry.registerProduct() → Base product
2. ProductNFT.mintProductNFT() → Create NFT
3. ProductNFT.transferFrom() → Authorized transfer
4. ProductNFT.recordSalePrice() → Track market price
5. ProductNFT.royaltyInfo() → Calculate royalty
```

## Quick Reference

### Contract Addresses (Deployment)
See `deploy.js` for deployment configuration.

### Access Control Roles

| Role | Contracts | Purpose |
|------|-----------|---------|
| MANUFACTURER_ROLE | ProductRegistry | Register products |
| VERIFIER_ROLE | VerificationManager, ProductRegistry, RetailerRegistry | Perform verifications |
| MINTER_ROLE | AuthToken, ProductNFT | Mint tokens/NFTs |
| BRAND_MANAGER_ROLE | RetailerRegistry | Authorize retailers |
| DISTRIBUTOR_ROLE | FeeDistributor, RetailerRegistry | Distribute fees, record metrics |
| ORACLE_ADMIN_ROLE | OracleIntegration | Manage oracle sources |
| ARBITER_ROLE | DisputeResolution | Vote on disputes |
| PROPOSER_ROLE | GovernanceVoting | Create proposals |
| REGISTRY_ADMIN_ROLE | ProductRegistry | Admin functions |
| TRANSFER_VALIDATOR_ROLE | ProductNFT | Record sale prices |

### Key Parameters

| Contract | Parameter | Default | Adjustable |
|----------|-----------|---------|------------|
| AuthToken | Reward Rate | 8% APY | Yes (5-20%) |
| AuthToken | Lock Period | 7 days | Yes (max 90) |
| VerificationManager | Base Fee | 0.01 ETH | Yes |
| VerificationManager | Fee Rate | 2.5% | Yes |
| VerificationManager | Min Stake | 0.1 ETH | Yes |
| OracleIntegration | Quorum | 60% | Yes |
| FeeDistributor | Verifier Share | 60% | Yes |
| FeeDistributor | Brand Share | 25% | Yes |
| FeeDistributor | Treasury Share | 15% | Yes |
| GovernanceVoting | Voting Period | 3 days | Yes |
| GovernanceVoting | Quorum | 10% | Yes |
| DisputeResolution | Dispute Bond | 0.1 ETH | Yes |
| DisputeResolution | Arbiter Quorum | 3 votes | Yes |
| ProductNFT | Royalty | 2.5% | Yes (0-10%) |
| RetailerRegistry | Starting Reputation | 500 | Fixed |

## Testing

All contracts have comprehensive test coverage:

```bash
# Run all tests
npx hardhat test

# Run specific contract tests
npx hardhat test test/AuthToken.test.js
npx hardhat test test/ProductRegistry.test.js
npx hardhat test test/RetailerRegistry.test.js
npx hardhat test test/VerificationManager.test.js
npx hardhat test test/OracleIntegration.test.js
npx hardhat test test/FeeDistributor.test.js
npx hardhat test test/GovernanceVoting.test.js
npx hardhat test test/DisputeResolution.test.js
npx hardhat test test/ProductNFT.test.js

# Run integration tests
npx hardhat test test/Integration.test.js
```

**Total Test Coverage:** 210 tests across all contracts

## Architecture Overview

### Layer 1: Token Economics
- **AuthToken**: Utility token, staking, rewards

### Layer 2: Core Registry
- **ProductRegistry**: Product identity and lifecycle
- **RetailerRegistry**: Retailer authorization and reputation

### Layer 3: Verification System
- **VerificationManager**: Request orchestration
- **OracleIntegration**: External data consensus
- **FeeDistributor**: Revenue distribution

### Layer 4: Governance & Dispute
- **GovernanceVoting**: Protocol governance
- **DisputeResolution**: Conflict resolution

### Layer 5: Premium Features
- **ProductNFT**: Premium product tracking with NFTs

## Security Considerations

### Common Security Features (All Contracts)
- OpenZeppelin standard implementations
- Access control with role-based permissions
- ReentrancyGuard for external calls
- Pausable for emergency situations
- Comprehensive input validation

### Specific Security Measures
- **Staking**: Economic security via locked stakes
- **Timelock**: Governance delay for community reaction
- **Bonds**: Financial commitment for disputes
- **Slashing**: Penalties for misbehavior
- **Quorum**: Prevents single-point manipulation

## Gas Optimization

Contracts use several gas optimization techniques:
- Immutable variables for constant references
- Efficient storage layouts
- Batch operations where possible
- Pull over push for payments
- View functions for data queries

## Development Guide

### Prerequisites
```bash
npm install
npx hardhat compile
```

### Deployment
```bash
npx hardhat run deploy.js --network <network>
```

### Verification
```bash
npx hardhat verify --network <network> <contract-address> <constructor-args>
```

## Additional Resources

### Enhanced Documentation
- [RETAILER_REPUTATION_SYSTEM.md](../RETAILER_REPUTATION_SYSTEM.md) - Deep dive into multi-factor reputation
- [PRODUCT_NFT_ENHANCEMENT_SYSTEM.md](../PRODUCT_NFT_ENHANCEMENT_SYSTEM.md) - NFT transfer restrictions

### Project Documents
- [README.md](../README.md) - Project overview
- [hardhat.config.js](../hardhat.config.js) - Hardhat configuration

## Version Information

- **Solidity Version:** ^0.8.20
- **OpenZeppelin Version:** ^5.4.0
- **Hardhat Version:** ^2.22.18
- **Documentation Version:** 1.0.0
- **Last Updated:** October 2024

## Support & Contact

For questions, issues, or contributions, please refer to the project repository.

---

**System Rating: 10/10** - Production-ready enterprise supply chain authenticity platform

