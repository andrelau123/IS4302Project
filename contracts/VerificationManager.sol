// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AuthToken.sol";
import "./ProductRegistry.sol";
import "./FeeDistributor.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Handles product verification requests, verifier staking, and fee distribution.
contract VerificationManager is AccessControl, ReentrancyGuard, Pausable {
    //roles
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    //external Contracts
    AuthToken public immutable authToken;
    ProductRegistry public immutable productRegistry;
    FeeDistributor public feeDistributor;

    uint256 public minVerificationFee = 0.1 ether;
    uint256 public maxVerificationFee = 1 ether;
    uint256 public minStakeAmount = 1_000 ether;
    uint256 public verificationTimeout = 3 days;

    //data Structures 
    struct Verifier {
        uint256 stakedAmount;
        uint256 totalVerifications;
        uint256 successfulVerifications;
        bool isActive;
    }

    struct VerificationRequest {
        bytes32 requestId;
        bytes32 productId;
        address requester;
        address assignedVerifier;
        uint256 fee;
        uint256 createdAt;
        bool completed;
        bool result;
    }

    mapping(address => Verifier) public verifiers;
    mapping(bytes32 => VerificationRequest) public requests;

    event VerifierRegistered(address indexed verifier, uint256 stake);
    event VerificationRequested(bytes32 indexed requestId, bytes32 indexed productId, address requester, uint256 fee);
    event VerificationAssigned(bytes32 indexed requestId, address indexed verifier);
    event VerificationCompleted(bytes32 indexed requestId, bool result, address verifier);
    event StakeWithdrawn(address indexed verifier, uint256 amount);
    event FeeDistributed(address indexed verifier, uint256 amount);
    event VerifierSlashed(address indexed verifier, uint256 penalty);
   
    constructor(address _authToken, address _productRegistry, address _feeDistributor) {
        require(_authToken != address(0) && _productRegistry != address(0), "Zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        authToken = AuthToken(_authToken);
        productRegistry = ProductRegistry(_productRegistry);
        feeDistributor = FeeDistributor(_feeDistributor);
    }

    function registerVerifier(uint256 stakeAmount) external nonReentrant whenNotPaused {
        require(stakeAmount >= minStakeAmount, "Insufficient stake");
        require(!verifiers[msg.sender].isActive, "Already registered");

        authToken.transferFrom(msg.sender, address(this), stakeAmount);

        verifiers[msg.sender] = Verifier({
            stakedAmount: stakeAmount,
            totalVerifications: 0,
            successfulVerifications: 0,
            isActive: true
        });

        _grantRole(VERIFIER_ROLE, msg.sender);
        emit VerifierRegistered(msg.sender, stakeAmount);
    }

    function withdrawStake() external nonReentrant {
        Verifier storage v = verifiers[msg.sender];
        require(v.isActive, "Not active");
        require(v.stakedAmount > 0, "No stake");

        uint256 amount = v.stakedAmount;
        v.isActive = false;
        v.stakedAmount = 0;
        _revokeRole(VERIFIER_ROLE, msg.sender);

        authToken.transfer(msg.sender, amount);
        emit StakeWithdrawn(msg.sender, amount);
    }

    // verification Lifecycle
    function requestVerification(bytes32 productId, uint256 productValue)
        external
        nonReentrant
        whenNotPaused
    {
        require(productRegistry.isRegistered(productId), "Product not found");

        uint256 fee = calculateVerificationFee(productValue);
        authToken.transferFrom(msg.sender, address(this), fee);

        bytes32 requestId = keccak256(abi.encodePacked(productId, msg.sender, block.timestamp));
        requests[requestId] = VerificationRequest({
            requestId: requestId,
            productId: productId,
            requester: msg.sender,
            assignedVerifier: address(0),
            fee: fee,
            createdAt: block.timestamp,
            completed: false,
            result: false
        });

        emit VerificationRequested(requestId, productId, msg.sender, fee);
    }

    /// @notice Assigns a verifier to a pending request (could be automated later via off-chain logic).
    function assignVerifier(bytes32 requestId, address verifier)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(hasRole(VERIFIER_ROLE, verifier), "Not a verifier");
        require(verifiers[verifier].stakedAmount >= minStakeAmount, "Verifier not active");
        VerificationRequest storage r = requests[requestId];
        require(!r.completed && r.assignedVerifier == address(0), "Invalid request");

        r.assignedVerifier = verifier;
        emit VerificationAssigned(requestId, verifier);
    }

    /// @notice Called by a verifier to finalize a request.
    function completeVerification(bytes32 requestId, bool result, string calldata evidenceURI)
        external
        onlyRole(VERIFIER_ROLE)
        nonReentrant
    {
        VerificationRequest storage r = requests[requestId];
        require(!r.completed, "Already completed");
        require(r.assignedVerifier == msg.sender, "Not assigned");
        require(block.timestamp <= r.createdAt + verificationTimeout, "Request expired");

        r.completed = true;
        r.result = result;

        Verifier storage v = verifiers[msg.sender];
        v.totalVerifications++;
        if (result) v.successfulVerifications++;

        // Distribute fee using FeeDistributor (automated 80/10/10 split)
        authToken.approve(address(feeDistributor), r.fee);
        feeDistributor.distributeRevenue(msg.sender, productRegistry.getBrandOwner(r.productId), r.fee);

        emit VerificationCompleted(requestId, result, msg.sender);
    }

    function calculateVerificationFee(uint256 productValue)
        public
        view
        returns (uint256)
    {
        uint256 fee = productValue / 1000; // 0.1%
        if (fee < minVerificationFee) return minVerificationFee;
        if (fee > maxVerificationFee) return maxVerificationFee;
        return fee;
    }

    /// @notice Internal function to slash verifier stake
    function slashVerifier(address verifier, uint256 penalty) internal {
        Verifier storage v = verifiers[verifier];
        require(v.stakedAmount >= penalty, "Insufficient stake");

        v.stakedAmount -= penalty;
        authToken.transfer(address(feeDistributor), penalty);
        emit VerifierSlashed(verifier, penalty);
    }

    /// @notice Admin can manually slash verifier stake for misconduct (linked to DisputeResolution outcomes).
    function adminSlashVerifier(address verifier, uint256 penalty)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        slashVerifier(verifier, penalty);
    }



    /// @notice Handle timeout for unresponded verification requests
    function handleTimeout(bytes32 requestId) external {
        VerificationRequest storage request = requests[requestId];
        require(!request.completed, "Already completed");
        require(block.timestamp >= request.createdAt + verificationTimeout, "Not timed out");

        // Slash the assigned verifier
        if (request.assignedVerifier != address(0)) {
            uint256 penalty = verifiers[request.assignedVerifier].stakedAmount / 10; // 10% penalty
            slashVerifier(request.assignedVerifier, penalty);
        }

        // Mark as completed with failed result
        request.completed = true;
        request.result = false;

        emit VerificationCompleted(requestId, false, request.assignedVerifier);
    }

    /// @notice Set verification fee range
    function setVerificationFees(uint256 _minFee, uint256 _maxFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_minFee <= _maxFee, "Invalid fee range");
        minVerificationFee = _minFee;
        maxVerificationFee = _maxFee;
    }

    /// @notice Set minimum stake amount for verifiers
    function setMinStakeAmount(uint256 _minStake) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minStakeAmount = _minStake;
    }

    /// @notice Set verification timeout period
    function setVerificationTimeout(uint256 _timeout) external onlyRole(DEFAULT_ADMIN_ROLE) {
        verificationTimeout = _timeout;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
