# Roles and Product Lifecycle — Full contract map

This file documents every on-chain contract in the project, the roles each defines, what they do, how they interact.

## Contracts

### AuthToken.sol
- Purpose: ERC-20 token used as the staking / payment token for verifiers and other protocol fees.
- Key behaviors: minting (during tests), transfer/approve, used by `VerificationManager.registerVerifier` and fee flows.
- Roles: token owner/admin (minting) — standard ERC‑20.
- Events: Transfer / Approval.
- Demo: show balances, approve -> stake via `VerificationManager.registerVerifier` (verifier staking panel).

### DisputeResolution.sol
- Purpose: A governance or arbitration helper (keeps track of disputes and outcomes). Contracts elsewhere (e.g., `RetailerRegistry`) may reference dispute outcomes to apply slashing or reputation changes.
- Key behaviors: create dispute, vote/judge outcome, finalize — triggers downstream slashing or reputation updates depending on outcome.
- Roles: dispute submitters and arbitrators (implementation dependent).
- Demo: show a recorded dispute and how `retailerRegistry.recordDispute` or admin actions follow.

### FeeDistributor.sol
- Purpose: Receive fees and redistribute them to protocol participants (verifiers, brand owners, treasury) according to configured splits.
- Key behaviors: `distributeRevenue(recipient, brandOwner, amount)` is called after verification completion; keeps an accounting and does transfers.
- Roles: admin to set splits.
- Demo: show `FeeDistributed` events after a verification is completed.

### GovernanceVoting.sol
- Purpose: On-chain governance primitive (proposal, vote, execute) for protocol-level parameter changes (fee rates, role updates, etc.).
- Key behaviors: createProposal, castVote, executeProposal.
- Roles: voters (token-weighted or role-based depending on implementation).
- Demo: show a sample proposal to change `verificationTimeout` and the vote/execute flow (optional for meeting).

### Marketplace.sol
- Purpose: Marketplace contract that lets token owners create listings and buyers purchase `ProductNFT`s.
- Key behaviors:
  - `createListing(tokenId, price)` — transfers token to marketplace custody and creates listing.
  - `purchaseNFT(tokenId)` — payable; transfers funds (platform fee to `feeRecipient`, remainder to seller) and transfers the NFT to buyer.
  - `updateListing`, `cancelListing`.
- Roles: owner (can change `platformFeeBps`, `feeRecipient`, pause/unpause).
- Important: Marketplace must often be whitelisted in `ProductNFT` (or buyers must be authorized) because `ProductNFT` enforces transfer recipient rules.
- Demo: list a token, show `ListingCreated` and `Purchased` events, show balances before/after.

### OracleIntegration.sol
- Purpose: Aggregation layer for off-chain attestations (IoT, human inspectors). Accepts signed EIP‑712 attestations (or trusted submissions) and computes a weighted aggregation per `requestId`.
- Key behaviors:
  - `registerSource(signer, type, weight)` — admin registers oracle/human sources with a weight.
  - `submitAttestation(a, signature)` (EIP‑712) or `submitAttestationTrusted(a, signerLike)` — submit an attestation for a `requestId`.
  - `getAggregate(requestId)` — returns (quorumReached, passed, totalWeight, passWeight, count).
- Roles: `ORACLE_ADMIN_ROLE` (manage sources), `SUBMITTER_ROLE` (trusted relayer optional).
- Demo: submit 2–3 attestations (trusted submit) for a verification request and show `getAggregate` moving from no quorum → quorumReached + passed.

### ProductNFT.sol
- Purpose: ERC‑721 token that represents a single authenticated product. Enforces transfer restrictions to ensure authenticity and authorized custody during supply-chain operations.
- Key roles:
  - `MINTER_ROLE` — authorized to mint ProductNFT for an authentic product.
  - `TRANSFER_VALIDATOR_ROLE` — allowed to record sale prices and act as a transfer validator (e.g., marketplace integration).
- Key behaviors:
  - `mintProductNFT(productId, owner)` — mint NFT for a product (product must be authentic).
  - Transfer restrictions: `requireRetailerAuthorization` and `transferRestrictionsEnabled` gate transfers; checks `RetailerRegistry.isAuthorizedRetailer(brand, recipient)` unless recipient is whitelisted.
  - `recordSalePrice(tokenId, price)` — only `TRANSFER_VALIDATOR_ROLE`.
  - `getTransferHistory`, `getTransferCount`, `canReceiveNFT` for UI.
- Demo: mint an NFT, attempt a transfer to an unauthorized address (should fail), whitelist marketplace and demonstrate a purchase.

### ProductRegistry.sol
- Purpose: Canonical registry of products and the on-chain record of supply-chain events and verification proofs.
- Key roles:
  - `MANUFACTURER_ROLE` — can register products.
  - `VERIFIER_ROLE` — can call `updateProductStatus` and `recordVerification` when a verification has been performed.
  - `REGISTRY_ADMIN_ROLE` / `DEFAULT_ADMIN_ROLE` — admin functions.
- Key behaviors:
  - `registerProduct(metadataURI)` → returns `productId` and records an initial TransferEvent.
  - `transferProduct(productId, to, location, verificationHash)` → record transfer event and require `to` be an authorized retailer for the brand (via `RetailerRegistry`).
  - `recordVerification(productId, verificationHash)` → append verification proof to product history (VERIFIER_ROLE).
  - `getProduct`, `getProductHistory`, `isRegistered`, `isAuthentic`.
- Demo: register product → transfer to an authorized retailer → call `recordVerification` to append verification evidence and show `getProductHistory`.

### RetailerRegistry.sol
- Purpose: Manage retailer onboarding, authorizations per brand, and compute on-chain reputation for retailers from verification outcomes and activity.
- Key roles:
  - `BRAND_MANAGER_ROLE` — register retailers, authorize/deauthorize for brands.
  - `VERIFICATION_MANAGER_ROLE` — allowed to call `processVerificationResult` to update retailer stats after a verification.
  - `PRODUCT_REGISTRY_ROLE` — ProductRegistry calls `recordProductHandling` to increment volume metrics.
- Key behaviors:
  - `registerRetailer(address, name)` — brand managers register retailers with initial reputation.
  - `authorizeRetailerForBrand(brand, retailer)` — brand-specific authorization.
  - `processVerificationResult(verificationId, productId, retailer, success)` — called by verification manager to update verification records and recalc reputation.
  - `getReputationBreakdown(retailer)` — returns components of the composite reputation score.
- Demo: show a retailer's `reputationScore`, process a verification result, and show the score change and emitted `ReputationUpdated` event.

### VerificationManager.sol
- Purpose: Orchestrates verification requests, verifier staking, assignment, completion, slashing, and fee handling for verification jobs.
- Key roles:
  - `VERIFIER_ROLE` — accounts that are registered verifiers (granted automatically during `registerVerifier`).
  - `DEFAULT_ADMIN_ROLE` — assigns verifiers to requests and can slash.
- Key behaviors:
  - `registerVerifier(stakeAmount)` — verifiers stake `AuthToken` and are recorded in `verifiers` mapping.
  - `requestVerification(productId, productValue)` — create a verification request and collect verification fee.
  - `assignVerifier(requestId, verifier)` — admin assigns a registered verifier.
  - `completeVerification(requestId, result, evidenceURI)` — assigned verifier finalizes the request, increments stats, transfers fee to `FeeDistributor`, emits `VerificationCompleted`.
  - `handleTimeout(requestId)` / `adminSlashVerifier` — slashing paths.
- Important integration note: `VerificationManager` transfers fees to `FeeDistributor` but does not automatically call `ProductRegistry.recordVerification` or `RetailerRegistry.processVerificationResult` in the current code — those post-processing steps must be performed by an authorized caller (admin, or a VerificationManager extension) after a verification completes.
- Demo: request → submit attestations (Oracle) → admin assigns verifier → verifier stakes & completes → show fee distribution and then call `recordVerification` + `processVerificationResult` to update product history and retailer reputation.


## Verification & staking end‑to‑end (how the pieces fit)

1. A product exists in `ProductRegistry` (registered by a manufacturer).
2. A user calls `VerificationManager.requestVerification(productId, productValue)` and pays the verification fee in `AuthToken`.
3. Off‑chain or front-end submits attestations to `OracleIntegration` (signed or trusted). Use `getAggregate(requestId)` to see whether quorum and pass thresholds are met.
4. Admin assigns a verifier (or an automated matching service does so) via `VerificationManager.assignVerifier(requestId, verifier)`.
5. Verifier stakes tokens via `AuthToken` + `VerificationManager.registerVerifier(stakeAmount)` to enable the role and be eligible.
6. Assigned verifier calls `VerificationManager.completeVerification(requestId, result, evidenceURI)`.
   - `VerificationManager` transfers the collected fee to `FeeDistributor.distributeRevenue(...)` which performs payout logic.
7. After completion an authorized caller should call:
   - `ProductRegistry.recordVerification(productId, verificationHash)` (append verification to product history) and
   - `RetailerRegistry.processVerificationResult(verificationId, productId, retailer, success)` (update retailer stats and reputation).

These last two steps are intentionally separate so your deployment can choose whether `VerificationManager` or a governance/admin agent performs post-processing (gives flexibility for dispute resolution and multi-step off-chain checks).


## Who stakes and why
- Verifiers: mandatory stakers in current design (implemented in `VerificationManager`). Staking aligns incentives and enables slashing on timeouts or misconduct.
- Oracle sources: currently register with weight in `OracleIntegration`; you may optionally require them to stake or require a trusted relayer with `SUBMITTER_ROLE`.
- Retailers: NOT stakers in current implementation. Reputation is used instead. If desired, you can add optional retailer collateral (recommended as a low-friction optional deposit rather than mandatory stake).



## Simple product event flow (example timeline)

The following condensed timeline shows the key on‑chain events and which contracts emit them for a single product lifecycle (manufacture → verification → marketplace sale). Use this in the demo slides to show the immutable trail.

1) Manufacture & registration
  - Action: Manufacturer calls `ProductRegistry.registerProduct(metadataURI)`.
  - Event(s): `ProductRegistered(productId, manufacturer, metadataURI)` (ProductRegistry).

2) Tokenization (optional)
  - Action: Minter calls `ProductNFT.mintProductNFT(productId, owner)`.
  - Event(s): `ProductNFTMinted(tokenId, productId, owner)` (ProductNFT).

3) Transfer to retailer (supply chain movement)
  - Action: Owner calls `ProductRegistry.transferProduct(productId, to, location, verificationHash)`.
  - Event(s): `ProductTransferred(productId, from, to, timestamp)` and `ProductStatusChanged(productId, InTransit)` (ProductRegistry).

4) Verification request
  - Action: User calls `VerificationManager.requestVerification(productId, productValue)` and pays fee.
  - Event(s): `VerificationRequested(requestId, productId, requester, fee)` (VerificationManager).

5) Oracle attestations (off‑chain → on‑chain)
  - Action: Oracle sources submit attestations via `OracleIntegration.submitAttestation` or `submitAttestationTrusted`.
  - Event(s): `Attested(requestId, productId, signer, verdict, weight, evidenceURI, ...)` (OracleIntegration).

6) Verifier assignment
  - Action: Admin calls `VerificationManager.assignVerifier(requestId, verifierAddress)`.
  - Event(s): `VerificationAssigned(requestId, verifier)` (VerificationManager).

7) Verifier completion
  - Action: Assigned verifier calls `VerificationManager.completeVerification(requestId, result, evidenceURI)`.
  - Event(s): `VerificationCompleted(requestId, result, verifier)` (VerificationManager);
    FeeDistributor receives tokens and may emit `FeeDistributed(verifier, amount)` (FeeDistributor) depending on distribution logic.

8) Post-processing (append proof & update reputation)
  - Action: Admin or VerificationManager calls `ProductRegistry.recordVerification(productId, verificationHash)` and `RetailerRegistry.processVerificationResult(verificationId, productId, retailer, success)`.
  - Event(s): `VerificationRecorded(productId, verificationHash)` (ProductRegistry) and `VerificationProcessed(verificationId, retailer, success)` + `ReputationUpdated(retailer, newScore, reason)` (RetailerRegistry).

9) Marketplace listing & sale
  - Action: Seller calls `Marketplace.createListing(tokenId, price)`; buyer calls `Marketplace.purchaseNFT(tokenId)`.
  - Event(s): `ListingCreated(listingId, tokenId, seller, price)` and `Purchased(listingId, tokenId, buyer, seller, price)` (Marketplace). `TransferRecorded(tokenId, from, to, timestamp, price)` (ProductNFT) may also be emitted by the NFT contract or transfer validator.

This linear event chain provides an auditable provenance trail: each step (registration, attestations, verification, reputation update, sale) is recorded as on‑chain events that any participant can query and verify.


## Quick on‑chain checks (Hardhat console)
1) Is an address a manufacturer?
```js
const pr = await ethers.getContractAt('ProductRegistry', '<PRODUCT_REGISTRY_ADDRESS>');
const r = await pr.MANUFACTURER_ROLE();
await pr.hasRole(r, '<ADDRESS>');
```

2) Get a verification request (fields)
```js
const vm = await ethers.getContractAt('VerificationManager', '<VERIFICATION_MANAGER_ADDRESS>');
const req = await vm.requests('<REQUEST_ID>');
console.log(req);
```

3) Get oracle aggregate for a request
```js
const oi = await ethers.getContractAt('OracleIntegration', '<ORACLE_INTEGRATION_ADDRESS>');
await oi.getAggregate('<REQUEST_ID>');
```

4) Check a retailer's reputation breakdown
```js
const rr = await ethers.getContractAt('RetailerRegistry', '<RETAILER_REGISTRY_ADDRESS>');
await rr.getReputationBreakdown('<RETAILER_ADDRESS>');
```

