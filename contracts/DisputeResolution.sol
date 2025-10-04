// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol"

contract DisputeResolution is AccessControl, ReentrancyGuard {
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    enum DisputeStatus {
        Open,
        UnderReview,
        Resolved,
        Rejected
    }

    struct Dispute {
        bytes32 disputeId;
        bytes32 productId;
        address initiator;
        string description;
        string evidenceURI; // IPFS hash
        DisputeStatus status;
        uint256 createdAt;
        uint256 votesFor;
        uint256 votesAgainst;
        mapping(address => bool) hasVoted;
    }

    ProductRegistry public productRegistry;
    AuthToken public authToken;

    uint256 public disputeFee = 10 ether; // 10 AUTH tokens
    uint256 public requiredVotes = 3;

    mapping(bytes32 => Dispute) public disputes;
    bytes32[] public disputeIds;

    event DisputeCreated(
        bytes32 indexed disputeId,
        bytes32 indexed productId,
        address initiator
    );
    event DisputeVoted(bytes32 indexed disputeId, address voter, bool inFavor);
    event DisputeResolved(bytes32 indexed disputeId, bool inFavor);

    constructor(address _productRegistry, address _authToken) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ARBITER_ROLE, msg.sender);
        productRegistry = ProductRegistry(_productRegistry);
        authToken = AuthToken(_authToken);
    }

    function createDispute(
        bytes32 productId,
        string calldata description,
        string calldata evidenceURI
    ) external nonReentrant {
        authToken.transferFrom(msg.sender, address(this), disputeFee);

        bytes32 disputeId = keccak256(
            abi.encodePacked(productId, msg.sender, block.timestamp)
        );

        Dispute storage dispute = disputes[disputeId];
        dispute.disputeId = disputeId;
        dispute.productId = productId;
        dispute.initiator = msg.sender;
        dispute.description = description;
        dispute.evidenceURI = evidenceURI;
        dispute.status = DisputeStatus.Open;
        dispute.createdAt = block.timestamp;
        dispute.votesFor = 0;
        dispute.votesAgainst = 0;

        disputeIds.push(disputeId);

        emit DisputeCreated(disputeId, productId, msg.sender);
    }

    function voteOnDispute(
        bytes32 disputeId,
        bool inFavor
    ) external onlyRole(ARBITER_ROLE) {
        Dispute storage dispute = disputes[disputeId];
        require(
            dispute.status == DisputeStatus.Open ||
                dispute.status == DisputeStatus.UnderReview,
            "Dispute not open"
        );
        require(!dispute.hasVoted[msg.sender], "Already voted");

        dispute.hasVoted[msg.sender] = true;
        dispute.status = DisputeStatus.UnderReview;

        if (inFavor) {
            dispute.votesFor++;
        } else {
            dispute.votesAgainst++;
        }

        emit DisputeVoted(disputeId, msg.sender, inFavor);

        // Auto-resolve if required votes reached
        if (
            dispute.votesFor >= requiredVotes ||
            dispute.votesAgainst >= requiredVotes
        ) {
            _resolveDispute(disputeId);
        }
    }

    function _resolveDispute(bytes32 disputeId) internal {
        Dispute storage dispute = disputes[disputeId];

        bool inFavor = dispute.votesFor > dispute.votesAgainst;
        dispute.status = inFavor
            ? DisputeStatus.Resolved
            : DisputeStatus.Rejected;

        // Refund dispute fee if resolved in favor
        if (inFavor) {
            authToken.transfer(dispute.initiator, disputeFee);
        }

        emit DisputeResolved(disputeId, inFavor);
    }

    function getDisputeCount() external view returns (uint256) {
        return disputeIds.length;
    }
}
