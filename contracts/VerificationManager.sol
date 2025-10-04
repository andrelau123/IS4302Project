// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol"

contract VerificationManager is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    AuthToken public authToken;
    ProductRegistry public productRegistry;

    uint256 public minVerificationFee = 0.1 ether; // In AUTH tokens (adjusted for decimals)
    uint256 public maxVerificationFee = 1 ether;
    uint256 public minStakeAmount = 1000 ether; // 1000 AUTH tokens

    struct Verifier {
        address verifierAddress;
        uint256 stakedAmount;
        uint256 totalVerifications;
        uint256 successfulVerifications;
        bool isActive;
    }

    struct VerificationRequest {
        bytes32 productId;
        address requester;
        uint256 fee;
        uint256 timestamp;
        bool completed;
        bool result;
    }

    mapping(address => Verifier) public verifiers;
    mapping(bytes32 => VerificationRequest) public verificationRequests;

    event VerifierRegistered(address indexed verifier, uint256 stakeAmount);
    event VerificationRequested(
        bytes32 indexed requestId,
        bytes32 indexed productId,
        address requester,
        uint256 fee
    );
    event VerificationCompleted(bytes32 indexed requestId, bool result);
    event FeeDistributed(address indexed verifier, uint256 amount);

    constructor(address _authToken, address _productRegistry) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        authToken = AuthToken(_authToken);
        productRegistry = ProductRegistry(_productRegistry);
    }

    function registerVerifier(uint256 stakeAmount) external whenNotPaused {
        require(stakeAmount >= minStakeAmount, "Insufficient stake");
        require(!verifiers[msg.sender].isActive, "Already registered");

        authToken.transferFrom(msg.sender, address(this), stakeAmount);

        verifiers[msg.sender] = Verifier({
            verifierAddress: msg.sender,
            stakedAmount: stakeAmount,
            totalVerifications: 0,
            successfulVerifications: 0,
            isActive: true
        });

        _grantRole(VERIFIER_ROLE, msg.sender);

        emit VerifierRegistered(msg.sender, stakeAmount);
    }

    function requestVerification(
        bytes32 productId,
        uint256 productValue
    ) external nonReentrant whenNotPaused {
        uint256 fee = calculateVerificationFee(productValue);

        authToken.transferFrom(msg.sender, address(this), fee);

        bytes32 requestId = keccak256(
            abi.encodePacked(productId, msg.sender, block.timestamp)
        );

        verificationRequests[requestId] = VerificationRequest({
            productId: productId,
            requester: msg.sender,
            fee: fee,
            timestamp: block.timestamp,
            completed: false,
            result: false
        });

        emit VerificationRequested(requestId, productId, msg.sender, fee);
    }

    function completeVerification(
        bytes32 requestId,
        bool result
    ) external onlyRole(VERIFIER_ROLE) nonReentrant {
        VerificationRequest storage request = verificationRequests[requestId];
        require(!request.completed, "Already completed");

        request.completed = true;
        request.result = result;

        Verifier storage verifier = verifiers[msg.sender];
        verifier.totalVerifications++;
        if (result) {
            verifier.successfulVerifications++;
        }

        // Distribute fee to verifier
        uint256 verifierShare = (request.fee * 80) / 100; // 80% to verifier
        authToken.transfer(msg.sender, verifierShare);

        emit VerificationCompleted(requestId, result);
        emit FeeDistributed(msg.sender, verifierShare);
    }

    function calculateVerificationFee(
        uint256 productValue
    ) public view returns (uint256) {
        // Fee is 0.1% of product value, capped between min and max
        uint256 fee = productValue / 1000;
        if (fee < minVerificationFee) return minVerificationFee;
        if (fee > maxVerificationFee) return maxVerificationFee;
        return fee;
    }

    function withdrawStake() external nonReentrant {
        Verifier storage verifier = verifiers[msg.sender];
        require(verifier.isActive, "Not a verifier");
        require(verifier.stakedAmount > 0, "No stake to withdraw");

        uint256 amount = verifier.stakedAmount;
        verifier.stakedAmount = 0;
        verifier.isActive = false;

        authToken.transfer(msg.sender, amount);
    }

    function setVerificationFees(
        uint256 _min,
        uint256 _max
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_min < _max, "Invalid fee range");
        minVerificationFee = _min;
        maxVerificationFee = _max;
    }
}
