// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RetailerRegistry is AccessControl, Pausable {
    bytes32 public constant BRAND_MANAGER_ROLE = keccak256("BRAND_MANAGER_ROLE");
    bytes32 public constant PRODUCT_REGISTRY_ROLE = keccak256("PRODUCT_REGISTRY_ROLE");
    bytes32 public constant VERIFICATION_MANAGER_ROLE = keccak256("VERIFICATION_MANAGER_ROLE");

    struct Retailer {
        bool isAuthorized;
        address retailerAddress;
        string name;
        uint256 reputationScore;        // Composite score (0-1000)
        uint256 totalVerifications;
        uint256 failedVerifications;
        uint256 registeredAt;
        uint256 totalProductsHandled;   // Volume metric
        uint256 totalDisputesReceived;  // Dispute history
        uint256 totalDisputesLost;      // Quality of disputes
        uint256 averageResponseTime;    // In seconds
        uint256 lastActivityTimestamp;  // For decay calculation
        uint256 consecutiveSuccesses;   // For consistency bonus
        uint256 lifetimeRevenueGenerated; // Economic contribution
    }

    // Reputation weight configuration (in basis points, sum = 10000)
    struct ReputationWeights {
        uint16 successRateWeight;      // Default: 4000 (40%)
        uint16 volumeWeight;           // Default: 1500 (15%)
        uint16 tenureWeight;           // Default: 1000 (10%)
        uint16 responseTimeWeight;     // Default: 1000 (10%)
        uint16 disputeWeight;          // Default: 1500 (15%)
        uint16 consistencyWeight;      // Default: 1000 (10%)
    }

    // Track which products/verifications have been used for reputation
    struct VerificationRecord {
        bytes32 productId;
        bytes32 verificationId;
        address retailer;
        bool success;
        uint256 timestamp;
        bool processed;
    }

    ReputationWeights public reputationWeights = ReputationWeights({
        successRateWeight: 4000,
        volumeWeight: 1500,
        tenureWeight: 1000,
        responseTimeWeight: 1000,
        disputeWeight: 1500,
        consistencyWeight: 1000
    });

    // Configuration parameters
    uint256 public constant MAX_REPUTATION_SCORE = 1000;
    uint256 public volumeTierThreshold = 100;       // Products needed for max volume score
    uint256 public tenureTierThreshold = 365 days;  // Time needed for max tenure score
    uint256 public optimalResponseTime = 1 days;    // Target response time
    uint256 public consistencyThreshold = 10;       // Consecutive successes for bonus
    uint256 public reputationDecayPeriod = 90 days; // Inactivity period before decay
    uint256 public decayRatePercent = 5;            // 5% decay per period

    // Rate limiting for reputation updates
    uint256 public constant MIN_UPDATE_INTERVAL = 1 hours;
    mapping(address => uint256) public lastReputationUpdate;

    // Track verification records to prevent double-counting
    mapping(bytes32 => VerificationRecord) public verificationRecords;
    mapping(bytes32 => bool) public productHandled; // Track if product counted for volume
    mapping(address => Retailer) public retailers;
    mapping(address => mapping(address => bool)) public brandAuthorizations;

    uint256 public maxReputationChangePerUpdate = 100; // Max ±100 points per update
    bool public requireProductLink = true; // Require product/verification linkage

    event RetailerRegistered(address indexed retailer, string name);
    event RetailerAuthorized(address indexed brand, address indexed retailer);
    event RetailerDeauthorized(address indexed brand, address indexed retailer);
    event ReputationUpdated(
        address indexed retailer, 
        uint256 newScore, 
        string updateReason
    );
    event DisputeRecorded(address indexed retailer, bool retailerWon);
    event ResponseTimeRecorded(address indexed retailer, uint256 responseTime);
    event VolumeIncreased(address indexed retailer, uint256 newTotalProducts);
    event ReputationWeightsUpdated(ReputationWeights newWeights);
    event VerificationProcessed(bytes32 indexed verificationId, address indexed retailer, bool success);
    event ProductHandled(bytes32 indexed productId, address indexed retailer);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRAND_MANAGER_ROLE, msg.sender);
    }

    function registerRetailer(
        address retailerAddress,
        string calldata name
    ) external onlyRole(BRAND_MANAGER_ROLE) whenNotPaused {
        require(!retailers[retailerAddress].isAuthorized, "Already registered");
        require(retailerAddress != address(0), "Zero address");
        require(bytes(name).length > 0, "Empty name");

        retailers[retailerAddress] = Retailer({
            isAuthorized: true,
            retailerAddress: retailerAddress,
            name: name,
            reputationScore: 500,  // Start at middle score
            totalVerifications: 0,
            failedVerifications: 0,
            registeredAt: block.timestamp,
            totalProductsHandled: 0,
            totalDisputesReceived: 0,
            totalDisputesLost: 0,
            averageResponseTime: 0,
            lastActivityTimestamp: block.timestamp,
            consecutiveSuccesses: 0,
            lifetimeRevenueGenerated: 0
        });

        emit RetailerRegistered(retailerAddress, name);
    }

    function authorizeRetailerForBrand(
        address brand,
        address retailer
    ) external onlyRole(BRAND_MANAGER_ROLE) whenNotPaused {
        require(retailers[retailer].isAuthorized, "Retailer not registered");
        require(brand != address(0), "Zero brand address");
        brandAuthorizations[brand][retailer] = true;
        emit RetailerAuthorized(brand, retailer);
    }

    function deauthorizeRetailerForBrand(
        address brand,
        address retailer
    ) external onlyRole(BRAND_MANAGER_ROLE) whenNotPaused {
        brandAuthorizations[brand][retailer] = false;
        emit RetailerDeauthorized(brand, retailer);
    }

    /// @notice Process verification result (called by VerificationManager only)
    /// @param verificationId Unique ID from VerificationManager
    /// @param productId Product being verified
    /// @param retailer Retailer being evaluated
    /// @param success Whether verification passed
    function processVerificationResult(
        bytes32 verificationId,
        bytes32 productId,
        address retailer,
        bool success
    ) external onlyRole(VERIFICATION_MANAGER_ROLE) nonReentrant whenNotPaused {
        require(retailers[retailer].isAuthorized, "Retailer not registered");
        require(verificationId != bytes32(0), "Invalid verification ID");
        require(!verificationRecords[verificationId].processed, "Already processed");

        // Rate limiting
        require(
            block.timestamp >= lastReputationUpdate[retailer] + MIN_UPDATE_INTERVAL,
            "Rate limited"
        );

        // Record the verification
        verificationRecords[verificationId] = VerificationRecord({
            productId: productId,
            verificationId: verificationId,
            retailer: retailer,
            success: success,
            timestamp: block.timestamp,
            processed: true
        });

        lastReputationUpdate[retailer] = block.timestamp;

        // Update retailer stats
        Retailer storage r = retailers[retailer];
        r.totalVerifications++;
        r.lastActivityTimestamp = block.timestamp;
        
        if (!success) {
            r.failedVerifications++;
            r.consecutiveSuccesses = 0;
        } else {
            r.consecutiveSuccesses++;
        }

        // Recalculate reputation
        uint256 oldScore = r.reputationScore;
        uint256 newScore = _calculateCompositeReputation(retailer);
        
        // Apply max change limit
        if (newScore > oldScore) {
            uint256 increase = newScore - oldScore;
            if (increase > maxReputationChangePerUpdate) {
                newScore = oldScore + maxReputationChangePerUpdate;
            }
        } else {
            uint256 decrease = oldScore - newScore;
            if (decrease > maxReputationChangePerUpdate) {
                newScore = oldScore - maxReputationChangePerUpdate;
            }
        }
        
        r.reputationScore = newScore;

        emit VerificationProcessed(verificationId, retailer, success);
        emit ReputationUpdated(retailer, newScore, "Verification result");
    }

    /// @notice Record product handling (called by ProductRegistry only)
    /// @param productId Unique product identifier
    /// @param retailer Retailer handling the product
    function recordProductHandling(
        bytes32 productId,
        address retailer
    ) external onlyRole(PRODUCT_REGISTRY_ROLE) nonReentrant whenNotPaused {
        require(retailers[retailer].isAuthorized, "Retailer not registered");
        require(productId != bytes32(0), "Invalid product ID");
        require(!productHandled[productId], "Product already counted");

        productHandled[productId] = true;
        
        Retailer storage r = retailers[retailer];
        r.totalProductsHandled++;
        r.lastActivityTimestamp = block.timestamp;
        
        emit ProductHandled(productId, retailer);
        
        // Recalculate reputation with new volume
        uint256 newScore = _calculateCompositeReputation(retailer);
        r.reputationScore = newScore;
        emit ReputationUpdated(retailer, newScore, "Product handled");
    }

    /// @notice Record retailer's response time for a request
    function recordResponseTime(
        address retailer,
        uint256 responseTime
    ) external onlyRole(VERIFICATION_MANAGER_ROLE) whenNotPaused {
        Retailer storage r = retailers[retailer];
        require(r.isAuthorized, "Retailer not registered");
        require(responseTime > 0, "Invalid response time");

        // Update average response time (weighted average)
        if (r.averageResponseTime == 0) {
            r.averageResponseTime = responseTime;
        } else {
            r.averageResponseTime = (r.averageResponseTime * 7 + responseTime * 3) / 10;
        }
        r.lastActivityTimestamp = block.timestamp;

        emit ResponseTimeRecorded(retailer, responseTime);
        
        uint256 newScore = _calculateCompositeReputation(retailer);
        r.reputationScore = newScore;
        emit ReputationUpdated(retailer, newScore, "Response time updated");
    }

    /// @notice Record dispute outcome for a retailer
    function recordDispute(
        address retailer,
        bool retailerWon
    ) external onlyRole(BRAND_MANAGER_ROLE) whenNotPaused {
        Retailer storage r = retailers[retailer];
        require(r.isAuthorized, "Retailer not registered");

        r.totalDisputesReceived++;
        if (!retailerWon) {
            r.totalDisputesLost++;
            r.consecutiveSuccesses = 0;
        }
        r.lastActivityTimestamp = block.timestamp;

        emit DisputeRecorded(retailer, retailerWon);
        
        uint256 newScore = _calculateCompositeReputation(retailer);
        r.reputationScore = newScore;
        emit ReputationUpdated(retailer, newScore, "Dispute recorded");
    }

    /// @notice Update retailer's lifetime revenue contribution
    function recordRevenue(
        address retailer,
        uint256 revenueAmount
    ) external onlyRole(BRAND_MANAGER_ROLE) whenNotPaused {
        Retailer storage r = retailers[retailer];
        require(r.isAuthorized, "Retailer not registered");
        require(revenueAmount > 0, "Invalid revenue");

        r.lifetimeRevenueGenerated += revenueAmount;
        r.lastActivityTimestamp = block.timestamp;
        
        uint256 newScore = _calculateCompositeReputation(retailer);
        r.reputationScore = newScore;
        emit ReputationUpdated(retailer, newScore, "Revenue recorded");
    }

    /// @notice DEPRECATED: Old function kept for backwards compatibility
    /// @dev Now requires product link or will revert
    function updateReputation(
        address retailer,
        bool success
    ) external view onlyRole(BRAND_MANAGER_ROLE) {
        require(!requireProductLink, "Use processVerificationResult instead");
        // Deprecated - does nothing
        retailer; success; // Silence unused variable warnings
    }

    /// @notice Calculate composite reputation score
    function _calculateCompositeReputation(address retailer) internal view returns (uint256) {
        Retailer storage r = retailers[retailer];
        
        uint256 decayMultiplier = _calculateDecayMultiplier(r.lastActivityTimestamp);
        
        uint256 successScore = _calculateSuccessRateScore(r.totalVerifications, r.failedVerifications);
        uint256 volumeScore = _calculateVolumeScore(r.totalProductsHandled);
        uint256 tenureScore = _calculateTenureScore(r.registeredAt);
        uint256 responseScore = _calculateResponseTimeScore(r.averageResponseTime);
        uint256 disputeScore = _calculateDisputeScore(r.totalDisputesReceived, r.totalDisputesLost);
        uint256 consistencyScore = _calculateConsistencyScore(r.consecutiveSuccesses);
        
        uint256 compositeScore = (
            successScore * reputationWeights.successRateWeight +
            volumeScore * reputationWeights.volumeWeight +
            tenureScore * reputationWeights.tenureWeight +
            responseScore * reputationWeights.responseTimeWeight +
            disputeScore * reputationWeights.disputeWeight +
            consistencyScore * reputationWeights.consistencyWeight
        ) / 10000;
        
        compositeScore = (compositeScore * decayMultiplier) / 100;
        
        return compositeScore > MAX_REPUTATION_SCORE ? MAX_REPUTATION_SCORE : compositeScore;
    }

    function _calculateSuccessRateScore(uint256 total, uint256 failed) internal pure returns (uint256) {
        if (total == 0) return 500;
        uint256 successRate = ((total - failed) * 100) / total;
        return (successRate * 10);
    }

    function _calculateVolumeScore(uint256 productsHandled) internal view returns (uint256) {
        if (productsHandled >= volumeTierThreshold) return 1000;
        return (productsHandled * 1000) / volumeTierThreshold;
    }

    function _calculateTenureScore(uint256 registeredAt) internal view returns (uint256) {
        uint256 tenure = block.timestamp - registeredAt;
        if (tenure >= tenureTierThreshold) return 1000;
        return (tenure * 1000) / tenureTierThreshold;
    }

    function _calculateResponseTimeScore(uint256 avgResponseTime) internal view returns (uint256) {
        if (avgResponseTime == 0) return 500;
        if (avgResponseTime <= optimalResponseTime) return 1000;
        if (avgResponseTime >= optimalResponseTime * 3) return 0;
        
        uint256 excessTime = avgResponseTime - optimalResponseTime;
        uint256 penaltyRange = optimalResponseTime * 2;
        return 1000 - (excessTime * 1000) / penaltyRange;
    }

    function _calculateDisputeScore(uint256 totalDisputes, uint256 disputesLost) internal pure returns (uint256) {
        if (totalDisputes == 0) return 1000;
        uint256 disputeWinRate = ((totalDisputes - disputesLost) * 100) / totalDisputes;
        return (disputeWinRate * 10);
    }

    function _calculateConsistencyScore(uint256 consecutiveSuccesses) internal view returns (uint256) {
        if (consecutiveSuccesses < consistencyThreshold) {
            return (consecutiveSuccesses * 1000) / consistencyThreshold;
        }
        return 1000;
    }

    function _calculateDecayMultiplier(uint256 lastActivity) internal view returns (uint256) {
        uint256 inactivePeriod = block.timestamp - lastActivity;
        if (inactivePeriod < reputationDecayPeriod) return 100;
        
        uint256 decayPeriods = inactivePeriod / reputationDecayPeriod;
        uint256 totalDecay = decayPeriods * decayRatePercent;
        if (totalDecay > 50) totalDecay = 50;
        
        return 100 - totalDecay;
    }

    function isAuthorizedRetailer(
        address brand,
        address retailer
    ) external view returns (bool) {
        return retailers[retailer].isAuthorized && brandAuthorizations[brand][retailer];
    }

    function getReputationBreakdown(address retailer) 
        external 
        view 
        returns (
            uint256 successScore,
            uint256 volumeScore,
            uint256 tenureScore,
            uint256 responseScore,
            uint256 disputeScore,
            uint256 consistencyScore,
            uint256 decayMultiplier,
            uint256 compositeScore
        ) 
    {
        Retailer storage r = retailers[retailer];
        require(r.isAuthorized, "Retailer not registered");
        
        decayMultiplier = _calculateDecayMultiplier(r.lastActivityTimestamp);
        successScore = _calculateSuccessRateScore(r.totalVerifications, r.failedVerifications);
        volumeScore = _calculateVolumeScore(r.totalProductsHandled);
        tenureScore = _calculateTenureScore(r.registeredAt);
        responseScore = _calculateResponseTimeScore(r.averageResponseTime);
        disputeScore = _calculateDisputeScore(r.totalDisputesReceived, r.totalDisputesLost);
        consistencyScore = _calculateConsistencyScore(r.consecutiveSuccesses);
        compositeScore = r.reputationScore;
    }

    // Admin functions
    function setMaxReputationChangePerUpdate(uint256 newMax) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newMax > 0 && newMax <= 500, "Invalid max change");
        maxReputationChangePerUpdate = newMax;
    }

    function setRequireProductLink(bool required) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        requireProductLink = required;
    }

    function updateReputationWeights(ReputationWeights calldata newWeights) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(
            uint256(newWeights.successRateWeight) +
            uint256(newWeights.volumeWeight) +
            uint256(newWeights.tenureWeight) +
            uint256(newWeights.responseTimeWeight) +
            uint256(newWeights.disputeWeight) +
            uint256(newWeights.consistencyWeight) == 10000,
            "Weights must sum to 10000"
        );
        
        reputationWeights = newWeights;
        emit ReputationWeightsUpdated(newWeights);
    }

    function setVolumeTierThreshold(uint256 newThreshold) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newThreshold > 0, "Invalid threshold");
        volumeTierThreshold = newThreshold;
    }

    function setTenureTierThreshold(uint256 newThreshold) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newThreshold > 0, "Invalid threshold");
        tenureTierThreshold = newThreshold;
    }

    function setOptimalResponseTime(uint256 newTime) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newTime > 0, "Invalid time");
        optimalResponseTime = newTime;
    }

    function setConsistencyThreshold(uint256 newThreshold) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newThreshold > 0, "Invalid threshold");
        consistencyThreshold = newThreshold;
    }

    function setDecayParameters(uint256 newPeriod, uint256 newRate) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newPeriod > 0, "Invalid period");
        require(newRate <= 100, "Rate too high");
        reputationDecayPeriod = newPeriod;
        decayRatePercent = newRate;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}