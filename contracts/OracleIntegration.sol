// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * OracleIntegration
 * Accepts signed IoT/human attestations and aggregates them (weighted quorum) per verification request.
 * Designed to be read by VerificationManager before finalizing a verification.
 */
contract OracleIntegration is AccessControl, ReentrancyGuard, Pausable, EIP712 {
    using ECDSA for bytes32;

    // roles
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE"); // can add/remove sources, tune params
    bytes32 public constant SUBMITTER_ROLE = keccak256("SUBMITTER_ROLE"); // (optional) can push unsigned data if enabled

    enum SourceType {
        IoT,
        Human
    }

    struct Source {
        bool active;
        SourceType sType;
        uint8 weight; // 1..100; used in quorum aggregation
    }

    // Attestation payload signed off-chain (EIP-712)
    struct Attestation {
        bytes32 requestId; // verification request (from VerificationManager)
        bytes32 productId; // product being verified
        bool verdict; // pass/fail from this source
        string evidenceURI; // IPFS/URL for photo/log blob
        uint256 readingCode; // optional (e.g., 1=Temp,2=GPS,3=Shock,...)
        int256 readingValue; // optional numeric reading (can be 0)
        uint256 timestamp; // when measured
        uint256 deadline; // signature valid-until
        uint256 nonce; // per-signer replay protection
    }

    bytes32 private constant ATTESTATION_TYPEHASH =
        keccak256(
            "Attestation(bytes32 requestId,bytes32 productId,bool verdict,string evidenceURI,uint256 readingCode,int256 readingValue,uint256 timestamp,uint256 deadline,uint256 nonce)"
        );

    // Per-signer nonce
    mapping(address => uint256) public nonces;

    // Registered oracle/human keys
    mapping(address => Source) public sources;

    // Aggregation state per request
    struct Aggregate {
        uint256 totalWeight; // sum of active unique sources that posted
        uint256 passWeight; // sum of weights whose verdict==true
        uint256 count; // number of unique attestations
        bool finalized; // optional latch if you want to prevent more attestations
        mapping(address => bool) seen; // source used?
    }
    mapping(bytes32 => Aggregate) private aggregates; // requestId => aggregate

    // Minimum weight required to consider quorum reached (e.g., 200 means 2 weighted sources if each is 100)
    uint256 public quorumWeight = 200; // default: require combined weight >= 200
    // Minimum pass ratio in basis points (e.g., 6000 = 60% of the weight must be "pass")
    uint256 public passBpsThreshold = 6000; // default: >= 60% pass among submitted weight

    event SourceRegistered(
        address indexed signer,
        SourceType sType,
        uint8 weight
    );
    event SourceUpdated(address indexed signer, bool active, uint8 weight);
    event SourceRevoked(address indexed signer);
    event Attested(
        bytes32 indexed requestId,
        bytes32 indexed productId,
        address indexed signer,
        bool verdict,
        uint8 weight,
        string evidenceURI,
        uint256 readingCode,
        int256 readingValue,
        uint256 timestamp
    );
    event AggregationParamsUpdated(
        uint256 quorumWeight,
        uint256 passBpsThreshold
    );
    event Finalized(bytes32 indexed requestId);

    constructor(address admin) EIP712("OracleIntegration", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN_ROLE, admin);
    }

    //admin/governance functions
    function registerSource(
        address signer,
        SourceType sType,
        uint8 weight
    ) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(signer != address(0), "Zero address");
        require(weight > 0, "Weight=0");
        sources[signer] = Source({active: true, sType: sType, weight: weight});
        emit SourceRegistered(signer, sType, weight);
    }

    function updateSource(
        address signer,
        bool active,
        uint8 weight
    ) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(
            sources[signer].sType == SourceType.IoT ||
                sources[signer].sType == SourceType.Human,
            "Not registered"
        );
        require(weight > 0, "Weight=0");
        sources[signer].active = active;
        sources[signer].weight = weight;
        emit SourceUpdated(signer, active, weight);
    }

    function revokeSource(address signer) external onlyRole(ORACLE_ADMIN_ROLE) {
        delete sources[signer];
        emit SourceRevoked(signer);
    }

    function setAggregationParams(
        uint256 _quorumWeight,
        uint256 _passBpsThreshold
    ) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(_quorumWeight > 0, "Bad quorum");
        require(_passBpsThreshold <= 10_000, "Bad bps");
        quorumWeight = _quorumWeight;
        passBpsThreshold = _passBpsThreshold;
        emit AggregationParamsUpdated(_quorumWeight, _passBpsThreshold);
    }

    function pause() external onlyRole(ORACLE_ADMIN_ROLE) {
        _pause();
    }
    function unpause() external onlyRole(ORACLE_ADMIN_ROLE) {
        _unpause();
    }

    // Submit signed attestation (EIP-712)
    function submitAttestation(
        Attestation calldata a,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        address signer = _recover(a, signature);
        Source memory src = sources[signer];
        require(src.active, "Unregistered/Revoked source");
        require(block.timestamp <= a.deadline, "Signature expired");

        Aggregate storage aggr = aggregates[a.requestId];
        require(!aggr.seen[signer], "Duplicate from source");
        // Mark used first (CEI pattern)
        aggr.seen[signer] = true;

        // Update aggregation
        aggr.totalWeight += src.weight;
        if (a.verdict) aggr.passWeight += src.weight;
        aggr.count += 1;

        emit Attested(
            a.requestId,
            a.productId,
            signer,
            a.verdict,
            src.weight,
            a.evidenceURI,
            a.readingCode,
            a.readingValue,
            a.timestamp
        );
    }

    // Submit attestation from trusted backend (SUBMITTER_ROLE only)
    function submitAttestationTrusted(
        Attestation calldata a,
        address signerLike
    ) external nonReentrant whenNotPaused onlyRole(SUBMITTER_ROLE) {
        Source memory src = sources[signerLike];
        require(src.active, "Unregistered/Revoked source");

        Aggregate storage aggr = aggregates[a.requestId];
        require(!aggr.seen[signerLike], "Duplicate from source");
        aggr.seen[signerLike] = true;

        aggr.totalWeight += src.weight;
        if (a.verdict) aggr.passWeight += src.weight;
        aggr.count += 1;

        emit Attested(
            a.requestId,
            a.productId,
            signerLike,
            a.verdict,
            src.weight,
            a.evidenceURI,
            a.readingCode,
            a.readingValue,
            a.timestamp
        );
    }

    // Get aggregated attestation result
    function getAggregate(
        bytes32 requestId
    )
        external
        view
        returns (
            bool quorumReached,
            bool passed,
            uint256 totalWeight,
            uint256 passWeight,
            uint256 count
        )
    {
        Aggregate storage a = aggregates[requestId];
        totalWeight = a.totalWeight;
        passWeight = a.passWeight;
        count = a.count;
        quorumReached = totalWeight >= quorumWeight;
        passed = (totalWeight == 0)
            ? false
            : ((passWeight * 10_000) / totalWeight) >= passBpsThreshold;
    }

    // Prevent further attestations for request
    function finalize(bytes32 requestId) external onlyRole(ORACLE_ADMIN_ROLE) {
        aggregates[requestId].finalized = true;
        emit Finalized(requestId);
    }

    // Check if source has already attested
    function hasSourceAttested(
        bytes32 requestId,
        address sourceAddr
    ) external view returns (bool) {
        return aggregates[requestId].seen[sourceAddr];
    }

    // helpers
    function _recover(
        Attestation calldata a,
        bytes calldata sig
    ) internal returns (address signer) {
        // Consume nonce for the recovered signer (prevents cross-request replay)
        // We compute signer first from a *copy* with expected nonce value
        bytes32 digest = _hashTypedDataV4(_structHash(a));
        signer = ECDSA.recover(digest, sig);
        require(a.nonce == nonces[signer], "Bad nonce");
        nonces[signer] += 1;
    }

    function _structHash(
        Attestation calldata a
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ATTESTATION_TYPEHASH,
                    a.requestId,
                    a.productId,
                    a.verdict,
                    keccak256(bytes(a.evidenceURI)),
                    a.readingCode,
                    a.readingValue,
                    a.timestamp,
                    a.deadline,
                    a.nonce
                )
            );
    }
}
