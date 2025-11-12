# Supply Chain Authenticity Platform

Blockchain-based product authentication and supply chain tracking system combating the $2.3 trillion global counterfeit market through decentralized verification, tokenized incentives, and immutable provenance records.

## Core Features

### Product Authentication & Tracking

- **Immutable Product Registry** - Each product gets a unique blockchain ID with complete ownership transfer history from manufacturer to end consumer
- **Lifecycle Management** - Track products through stages: Registered → InTransit → AtRetailer → Sold, with timestamps and location metadata
- **Transfer Verification** - All ownership transfers require cryptographic signatures preventing unauthorized product movement

### Verification System

- **Multi-Party Verification** - Independent verifiers stake 1000 AUTH tokens to participate, creating economic accountability
- **Attestation Mechanism** - Products can be verified by any authorized verifier, with results recorded immutably on-chain
- **Verification Rewards** - Verifiers earn 40% of verification fees (default 100 AUTH per verification)

### Dispute & Governance

- **Decentralized Dispute Resolution** - Token holders can challenge verifications by staking tokens and calling for community vote
- **Multi-Verifier Arbitration** - Disputes require 3+ verifier votes to resolve, with majority decision flipping verification status
- **Economic Penalties** - Losing party in disputes faces stake slashing (50% penalty), incentivizing honest behavior

### Digital Assets & Trading

- **NFT Tokenization** - Manufacturers can mint ERC-721 NFTs for products, creating tradeable digital certificates of authenticity
- **Marketplace Integration** - Built-in marketplace for trading product NFTs with automated royalty distribution
- **Metadata Storage** - Product information and images stored on IPFS, linked via on-chain metadata URIs

### Economic Model

- **Fee Distribution** - Automated revenue sharing: 40% to verifiers, 40% to brand owners, 20% to platform treasury
- **Staking Requirements** - Verifiers stake tokens, dispute initiators risk funds, creating skin-in-the-game dynamics
- **Token Governance** - AUTH token holders vote on protocol parameters (fees, stake amounts, penalty rates)

## Architecture

**Smart Contracts:** 10 Solidity contracts on Ethereum L2  
**Storage:** IPFS for metadata, on-chain for ownership/verification  
**Standards:** ERC-20 (utility token), ERC-721 (product NFTs), EIP-712 (signed data)

## Smart Contracts

| Contract                 | Purpose                    | Key Features                                                                                   |
| ------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------- |
| **ProductRegistry**      | Product lifecycle tracking | Unique IDs, ownership chain, status management (Registered→InTransit→AtRetailer→Sold→Disputed) |
| **AuthToken** (ERC-20)   | Utility token              | 1B supply, staking, verification fees, governance voting                                       |
| **VerificationManager**  | Verification coordination  | Request management, verifier staking (1000 AUTH), fee calculation                              |
| **FeeDistributor**       | Revenue sharing            | 40% verifier, 40% brand, 20% treasury distribution                                             |
| **DisputeResolution**    | Conflict arbitration       | Multi-verifier voting, stake slashing, verification reversal                                   |
| **ProductNFT** (ERC-721) | Optional tokenization      | Digital certificates, marketplace trading, provenance                                          |
| **RetailerRegistry**     | Retailer authorization     | Brand-specific approval, reputation scoring                                                    |
| **GovernanceVoting**     | Protocol governance        | Token-weighted proposals, 2-day timelock                                                       |
| **OracleIntegration**    | External data              | EIP-712 signed attestations, multi-source consensus                                            |
| **Marketplace**          | NFT trading                | Peer-to-peer sales, escrow, AUTH token payments                                                |

## Product Flows

### Registration & Transfer

1. Manufacturer registers product → Unique ID + metadata stored
2. Transfer to retailer → Authorization check + status update (InTransit)
3. Retailer confirms receipt → Status: AtRetailer
4. Sale to customer → Status: Sold, ownership transfer

### Verification & Disputes

1. User requests verification → Pays fee in AUTH tokens
2. Verifier performs check → Records result (pass/fail) + evidence
3. If result passes → `isVerified` flag flipped to true
4. If disputed → Multi-verifier voting, stake slashing on false claims
5. Dispute successful → `isVerified` flipped (reverses verification)

### NFT Minting & Trading (Optional)

1. Current owner mints NFT → ERC-721 token linked to productId
2. List on marketplace → Set price in AUTH tokens
3. Purchase → Escrow payment, ownership transfer
4. NFT transfers independently from physical product tracking

## Economic Model

**Verification Fees:** 0.1 AUTH per verification (configurable)  
**Fee Distribution:** 40% verifier | 40% brand owner | 20% treasury  
**Verifier Staking:** 1000 AUTH minimum  
**Dispute Bonds:** 10 AUTH (refunded if upheld)  
**Slashing:** 100 AUTH penalty for false verifications

## Getting Started

### Installation

```bash
npm install
npx hardhat compile
```

### Local Development

```bash
# Terminal 1: Start local blockchain
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat run scripts/deploy-with-frontend.js --network localhost

# Terminal 3: Start frontend
cd frontend && npm start
```

### Testing

```bash
npx hardhat test                    # All tests
npx hardhat test test/Integration.test.js  # Integration tests
npx hardhat coverage                # Coverage report
```

## Project Structure

```
contracts/          # 10 Solidity smart contracts
frontend/           # React web application
test/              # Comprehensive test suites
scripts/           # Deployment and demo scripts
docs/              # Contract documentation
```

## Key Features by Role

**Manufacturers:** Register products, authorize retailers, earn 40% of verification fees  
**Retailers:** Gain brand authorization, build reputation, transfer verified products  
**Consumers:** Verify authenticity, mint NFTs, trade on marketplace  
**Verifiers:** Stake tokens (1000 AUTH), perform verifications, earn 40% fees  
**Community:** Propose governance changes, vote on parameters, dispute resolutions

## Security & Performance

**Security:** OpenZeppelin contracts, role-based access, reentrancy guards, pausable  
**Testing:** Comprehensive test coverage with integration tests  
**Gas Costs:** ~180k (register) | ~200k (verify) | ~150k (transfer) | ~227k (mint NFT)

## Documentation

📚 [Full Contract Docs](./docs/) | [Roles & Flows](./docs/ROLES_AND_FLOWS.md)

## Technology Stack

**Blockchain:** Solidity ^0.8.20, Hardhat, OpenZeppelin ^5.4.0  
**Frontend:** React, ethers.js v6, TailwindCSS  
**Standards:** ERC-20, ERC-721, EIP-712  
**Testing:** Chai, Hardhat Network
