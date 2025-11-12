// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AuthToken.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// Token-weighted voting contract for protocol-level decisions in the AUTH ecosystem.
/// Voters must stake or hold AUTH tokens; each proposal runs for a fixed period.
contract GovernanceVoting is AccessControl, ReentrancyGuard {
    // Roles
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");

    // Structs
    struct Proposal {
        uint256 proposalId;
        string title;
        string description;
        address proposer;
        uint256 startTime;
        uint256 endTime;
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
        bool passed;
        mapping(address => bool) hasVoted;
    }

    // State variables
    AuthToken public immutable authToken;
    uint256 public constant MIN_PROPOSAL_TOKENS = 10_000 * 10 ** 18; // require min stake to propose
    uint256 public votingDuration = 3 days;
    uint256 public proposalCounter;
    mapping(uint256 => Proposal) public proposals;
    uint256 public quorumPercent = 10; // 10% of total supply required
    uint256 public totalVotesCasted;

    // Events
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        string title
    );
    event VoteCast(
        uint256 indexed id,
        address indexed voter,
        bool support,
        uint256 weight
    );
    event ProposalExecuted(uint256 indexed id, bool passed);

    constructor(address _authToken, address admin) {
        require(_authToken != address(0), "Invalid token address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROPOSER_ROLE, admin);
        authToken = AuthToken(_authToken);
    }

    /// Create a new proposal.
    function createProposal(
        string calldata title,
        string calldata description
    ) external onlyRole(PROPOSER_ROLE) returns (uint256) {
        require(
            authToken.balanceOf(msg.sender) >= MIN_PROPOSAL_TOKENS,
            "Not enough AUTH to propose"
        );

        uint256 proposalId = ++proposalCounter;
        Proposal storage p = proposals[proposalId];
        p.proposalId = proposalId;
        p.title = title;
        p.description = description;
        p.proposer = msg.sender;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + votingDuration;

        emit ProposalCreated(proposalId, msg.sender, title);
        return proposalId;
    }

    /// Cast a vote on a proposal (weighted by AUTH balance).
    function vote(uint256 proposalId, bool support) external nonReentrant {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.startTime, "Voting not started");
        require(block.timestamp < p.endTime, "Voting ended");
        require(!p.hasVoted[msg.sender], "Already voted");

        uint256 weight = authToken.balanceOf(msg.sender);
        require(weight > 0, "No voting power");

        p.hasVoted[msg.sender] = true;
        if (support) p.votesFor += weight;
        else p.votesAgainst += weight;

        totalVotesCasted += weight;
        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /// Execute proposal results after voting ends.
    function executeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.endTime, "Voting still open");
        require(!p.executed, "Already executed");

        uint256 totalSupply = authToken.totalSupply();
        uint256 totalVotes = p.votesFor + p.votesAgainst;
        bool meetsQuorum = (totalVotes * 100) / totalSupply >= quorumPercent;

        p.executed = true;
        if (meetsQuorum && p.votesFor > p.votesAgainst) {
            p.passed = true;
        }

        emit ProposalExecuted(proposalId, p.passed);
    }

    // View functions
    function getProposal(
        uint256 id
    )
        external
        view
        returns (
            string memory title,
            string memory description,
            address proposer,
            uint256 start,
            uint256 end,
            uint256 forVotes,
            uint256 againstVotes,
            bool executed,
            bool passed
        )
    {
        Proposal storage p = proposals[id];
        return (
            p.title,
            p.description,
            p.proposer,
            p.startTime,
            p.endTime,
            p.votesFor,
            p.votesAgainst,
            p.executed,
            p.passed
        );
    }

    function getActiveProposals() external view returns (uint256[] memory ids) {
        uint256 count;
        for (uint256 i = 1; i <= proposalCounter; i++) {
            if (
                block.timestamp < proposals[i].endTime && !proposals[i].executed
            ) {
                count++;
            }
        }
        ids = new uint256[](count);
        uint256 j;
        for (uint256 i = 1; i <= proposalCounter; i++) {
            if (
                block.timestamp < proposals[i].endTime && !proposals[i].executed
            ) {
                ids[j++] = i;
            }
        }
    }

    // Admin functions
    function setVotingDuration(
        uint256 newDuration
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            newDuration >= 1 days && newDuration <= 14 days,
            "Invalid duration"
        );
        votingDuration = newDuration;
    }

    function setQuorumPercent(
        uint256 newQuorum
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newQuorum >= 5 && newQuorum <= 50, "Out of range");
        quorumPercent = newQuorum;
    }
}
