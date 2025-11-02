// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AuthToken.sol";
import "./ProductRegistry.sol";
import "./VerificationManager.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DisputeResolution is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    enum DisputeStatus {
        None,
        Open,
        UnderReview,
        Resolved,
        Rejected,
        Expired
    }

    struct Dispute {
        bytes32 disputeId;
        bytes32 productId;
        address initiator;
        string description;
        string evidenceURI; // IPFS CID
        DisputeStatus status;
        uint64 createdAt;
        uint64 resolvedAt;
        uint8 votesFor;
        uint8 votesAgainst;
        bool inFavor;
        address[] voters; // Track who voted
    }

    ProductRegistry public productRegistry;
    AuthToken public authToken;
    VerificationManager public verificationManager; // Reference to VerificationManager for checking verifier status

    uint256 public disputeFee = 10 ether; // 10 AUTH (18 decimals)
    uint256 public bondAmount = 5 ether; // 5 AUTH refundable if legitimate
    uint256 public verifierRewardPerVote = 3 ether; // 3 AUTH reward per correct vote (from dispute fee)
    uint8 public requiredVotes = 3;
    uint64 public votingPeriod = 3 days;

    mapping(bytes32 => Dispute) public disputes;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    mapping(bytes32 => mapping(address => bool)) public verifierVotes; // Track how each verifier voted (true = inFavor)
    bytes32[] public disputeIds;

    event DisputeCreated(
        bytes32 indexed disputeId,
        bytes32 indexed productId,
        address indexed initiator
    );
    event DisputeVoted(
        bytes32 indexed disputeId,
        address indexed voter,
        bool inFavor
    );
    event DisputeResolved(
        bytes32 indexed disputeId,
        bool inFavor,
        uint256 refund
    );
    event DisputeExpired(bytes32 indexed disputeId);
    event ConfigUpdated(string parameter, uint256 newValue);
    event VerifierRewarded(address indexed verifier, uint256 amount);

    constructor(
        address _productRegistry,
        address _authToken,
        address _verificationManager
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        productRegistry = ProductRegistry(_productRegistry);
        authToken = AuthToken(_authToken);
        verificationManager = VerificationManager(_verificationManager);
    }

    /// @notice Set the VerificationManager address (for checking verifier status)
    function setVerificationManager(
        address _verificationManager
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        verificationManager = VerificationManager(_verificationManager);
    }

    function createDispute(
        bytes32 productId,
        string calldata description,
        string calldata evidenceURI
    ) external nonReentrant whenNotPaused {
        require(productId != bytes32(0), "Invalid product");
        require(bytes(description).length > 0, "Empty description");

        // Pay dispute fee + bond
        uint256 totalCost = disputeFee + bondAmount;
        authToken.transferFrom(msg.sender, address(this), totalCost);

        bytes32 disputeId = keccak256(
            abi.encodePacked(productId, msg.sender, block.timestamp)
        );
        require(disputes[disputeId].status == DisputeStatus.None, "Duplicate");

        Dispute storage d = disputes[disputeId];
        d.disputeId = disputeId;
        d.productId = productId;
        d.initiator = msg.sender;
        d.description = description;
        d.evidenceURI = evidenceURI;
        d.status = DisputeStatus.Open;
        d.createdAt = uint64(block.timestamp);

        disputeIds.push(disputeId);
        emit DisputeCreated(disputeId, productId, msg.sender);
    }

    /// @notice Vote on a dispute (only active verifiers can vote)
    function voteOnDispute(
        bytes32 disputeId,
        bool inFavor
    ) external whenNotPaused nonReentrant {
        // Check if caller is an active verifier (has VERIFIER_ROLE in VerificationManager)
        require(
            verificationManager.hasRole(VERIFIER_ROLE, msg.sender),
            "Not a verifier"
        );

        Dispute storage d = disputes[disputeId];
        require(
            d.status == DisputeStatus.Open ||
                d.status == DisputeStatus.UnderReview,
            "Closed"
        );
        require(!hasVoted[disputeId][msg.sender], "Already voted");
        require(
            block.timestamp <= d.createdAt + votingPeriod,
            "Voting expired"
        );

        hasVoted[disputeId][msg.sender] = true;
        verifierVotes[disputeId][msg.sender] = inFavor; // Store how they voted
        d.voters.push(msg.sender); // Track voter
        d.status = DisputeStatus.UnderReview;

        if (inFavor) d.votesFor++;
        else d.votesAgainst++;

        emit DisputeVoted(disputeId, msg.sender, inFavor);

        // Auto-resolve if quorum reached
        if (d.votesFor >= requiredVotes || d.votesAgainst >= requiredVotes) {
            _resolveDispute(disputeId);
        }
    }

    //Internal Resolution
    function _resolveDispute(bytes32 disputeId) internal {
        Dispute storage d = disputes[disputeId];
        require(
            d.status == DisputeStatus.UnderReview ||
                d.status == DisputeStatus.Open,
            "Not active"
        );

        d.inFavor = d.votesFor > d.votesAgainst;
        d.status = d.inFavor ? DisputeStatus.Resolved : DisputeStatus.Rejected;
        d.resolvedAt = uint64(block.timestamp);

        // Reward verifiers who voted with the majority
        uint256 rewardPerVerifier = 3 * 10 ** 18; // 3 AUTH per verifier
        for (uint256 i = 0; i < d.voters.length; i++) {
            address voter = d.voters[i];
            bool votedInFavor = verifierVotes[disputeId][voter];

            // Reward if voted with majority
            if (votedInFavor == d.inFavor) {
                authToken.transfer(voter, rewardPerVerifier);
                emit VerifierRewarded(voter, rewardPerVerifier);
            }
        }

        uint256 refund = 0;
        if (d.inFavor) {
            // Refund both dispute fee + bond
            refund = disputeFee + bondAmount;
            authToken.transfer(d.initiator, refund);
        } else {
            // If rejected, bond stays locked in contract (treasury)
        }

        emit DisputeResolved(disputeId, d.inFavor, refund);
    }

    /// @notice Anyone can mark a dispute expired after voting window passes.
    function markExpired(bytes32 disputeId) external {
        Dispute storage d = disputes[disputeId];
        require(
            d.status == DisputeStatus.Open ||
                d.status == DisputeStatus.UnderReview,
            "Already closed"
        );
        require(
            block.timestamp > d.createdAt + votingPeriod,
            "Not expired yet"
        );

        d.status = DisputeStatus.Expired;
        emit DisputeExpired(disputeId);
    }

    //Admin Config
    function setDisputeFee(
        uint256 newFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        disputeFee = newFee;
        emit ConfigUpdated("disputeFee", newFee);
    }

    function setBondAmount(
        uint256 newBond
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bondAmount = newBond;
        emit ConfigUpdated("bondAmount", newBond);
    }

    function setRequiredVotes(
        uint8 newVotes
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newVotes > 0 && newVotes <= 10, "Invalid votes");
        requiredVotes = newVotes;
        emit ConfigUpdated("requiredVotes", newVotes);
    }

    function setVotingPeriod(
        uint64 newPeriod
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newPeriod >= 1 days && newPeriod <= 14 days, "Out of range");
        votingPeriod = newPeriod;
        emit ConfigUpdated("votingPeriod", newPeriod);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function getDispute(
        bytes32 disputeId
    ) external view returns (Dispute memory) {
        return disputes[disputeId];
    }

    function getDisputeCount() external view returns (uint256) {
        return disputeIds.length;
    }
}
