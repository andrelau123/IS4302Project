// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RetailerRegistry is AccessControl, Pausable {
    bytes32 public constant BRAND_MANAGER_ROLE =
        keccak256("BRAND_MANAGER_ROLE");

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

    mapping(address => Retailer) public retailers;
    mapping(address => mapping(address => bool)) public brandAuthorizations;

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

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRAND_MANAGER_ROLE, msg.sender);
    }

    function registerRetailer(
        address retailerAddress,
        string calldata name
    ) external onlyRole(BRAND_MANAGER_ROLE) whenNotPaused {
        require(!retailers[retailerAddress].isAuthorized, "Already registered");

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

    /// @notice Update reputation based on verification result with multi-factor calculation
    /// @param retailer Address of the retailer
    /// @param success Whether the verification was successful
    function updateReputation(
        address retailer,
        bool success
    ) external onlyRole(BRAND_MANAGER_ROLE) whenNotPaused {
        Retailer storage r = retailers[retailer];
        require(r.isAuthorized, "Retailer not registered");

        // Update verification stats
        r.totalVerifications++;
        r.lastActivityTimestamp = block.timestamp;
        
        if (!success) {
            r.failedVerifications++;
            r.consecutiveSuccesses = 0; // Reset consistency bonus
        } else {
            r.consecutiveSuccesses++;
        }

        // Recalculate composite reputation score
        uint256 newScore = _calculateCompositeReputation(retailer);
        r.reputationScore = newScore;

        emit ReputationUpdated(retailer, newScore, "Verification result");
    }

    /// @notice Record product handling volume for a retailer
    /// @param retailer Address of the retailer
    /// @param productsCount Number of products handled
    function recordProductVolume(
        address retailer,
        uint256 productsCount
    ) external onlyRole(BRAND_MANAGER_ROLE) whenNotPaused {
        Retailer storage r = retailers[retailer];
        require(r.isAuthorized, "Retailer not registered");

        r.totalProductsHandled += productsCount;
        r.lastActivityTimestamp = block.timestamp;
        
        emit VolumeIncreased(retailer, r.totalProductsHandled);
        
        // Recalculate reputation with new volume
        uint256 newScore = _calculateCompositeReputation(retailer);
        r.reputationScore = newScore;
        emit ReputationUpdated(retailer, newScore, "Volume increased");
    }

    /// @notice Record retailer's response time for a request
    /// @param retailer Address of the retailer
    /// @param responseTime Time taken to respond (in seconds)
    function recordResponseTime(
        address retailer,
        uint256 responseTime
    ) external onlyRole(BRAND_MANAGER_ROLE) whenNotPaused {
        Retailer storage r = retailers[retailer];
        require(r.isAuthorized, "Retailer not registered");

        // Update average response time (weighted average)
        if (r.averageResponseTime == 0) {
            r.averageResponseTime = responseTime;
        } else {
            // Weighted average: 70% old, 30% new
            r.averageResponseTime = (r.averageResponseTime * 7 + responseTime * 3) / 10;
        }
        r.lastActivityTimestamp = block.timestamp;

        emit ResponseTimeRecorded(retailer, responseTime);
        
        // Recalculate reputation with new response time
        uint256 newScore = _calculateCompositeReputation(retailer);
        r.reputationScore = newScore;
        emit ReputationUpdated(retailer, newScore, "Response time updated");
    }

    /// @notice Record dispute outcome for a retailer
    /// @param retailer Address of the retailer
    /// @param retailerWon Whether the retailer won the dispute
    function recordDispute(
        address retailer,
        bool retailerWon
    ) external onlyRole(BRAND_MANAGER_ROLE) whenNotPaused {
        Retailer storage r = retailers[retailer];
        require(r.isAuthorized, "Retailer not registered");

        r.totalDisputesReceived++;
        if (!retailerWon) {
            r.totalDisputesLost++;
            r.consecutiveSuccesses = 0; // Reset consistency bonus
        }
        r.lastActivityTimestamp = block.timestamp;

        emit DisputeRecorded(retailer, retailerWon);
        
        // Recalculate reputation with dispute history
        uint256 newScore = _calculateCompositeReputation(retailer);
        r.reputationScore = newScore;
        emit ReputationUpdated(retailer, newScore, "Dispute recorded");
    }

    /// @notice Update retailer's lifetime revenue contribution
    /// @param retailer Address of the retailer
    /// @param revenueAmount Revenue amount to add
    function recordRevenue(
        address retailer,
        uint256 revenueAmount
    ) external onlyRole(BRAND_MANAGER_ROLE) whenNotPaused {
        Retailer storage r = retailers[retailer];
        require(r.isAuthorized, "Retailer not registered");

        r.lifetimeRevenueGenerated += revenueAmount;
        r.lastActivityTimestamp = block.timestamp;
        
        // Recalculate reputation
        uint256 newScore = _calculateCompositeReputation(retailer);
        r.reputationScore = newScore;
        emit ReputationUpdated(retailer, newScore, "Revenue recorded");
    }

    /// @notice Calculate composite reputation score based on multiple factors
    /// @param retailer Address of the retailer
    /// @return Composite reputation score (0-1000)
    function _calculateCompositeReputation(address retailer) internal view returns (uint256) {
        Retailer storage r = retailers[retailer];
        
        // Apply decay if inactive
        uint256 decayMultiplier = _calculateDecayMultiplier(r.lastActivityTimestamp);
        
        // Calculate individual component scores (each 0-1000)
        uint256 successScore = _calculateSuccessRateScore(r.totalVerifications, r.failedVerifications);
        uint256 volumeScore = _calculateVolumeScore(r.totalProductsHandled);
        uint256 tenureScore = _calculateTenureScore(r.registeredAt);
        uint256 responseScore = _calculateResponseTimeScore(r.averageResponseTime);
        uint256 disputeScore = _calculateDisputeScore(r.totalDisputesReceived, r.totalDisputesLost);
        uint256 consistencyScore = _calculateConsistencyScore(r.consecutiveSuccesses);
        
        // Weighted composite score
        uint256 compositeScore = (
            successScore * reputationWeights.successRateWeight +
            volumeScore * reputationWeights.volumeWeight +
            tenureScore * reputationWeights.tenureWeight +
            responseScore * reputationWeights.responseTimeWeight +
            disputeScore * reputationWeights.disputeWeight +
            consistencyScore * reputationWeights.consistencyWeight
        ) / 10000;
        
        // Apply decay multiplier
        compositeScore = (compositeScore * decayMultiplier) / 100;
        
        // Cap at MAX_REPUTATION_SCORE
        return compositeScore > MAX_REPUTATION_SCORE ? MAX_REPUTATION_SCORE : compositeScore;
    }

    /// @notice Calculate success rate component score (0-1000)
    function _calculateSuccessRateScore(uint256 total, uint256 failed) internal pure returns (uint256) {
        if (total == 0) return 500; // Neutral score for new retailers
        uint256 successRate = ((total - failed) * 100) / total;
        return (successRate * 10); // Convert percentage to 0-1000 scale
    }

    /// @notice Calculate volume component score (0-1000)
    function _calculateVolumeScore(uint256 productsHandled) internal view returns (uint256) {
        if (productsHandled >= volumeTierThreshold) return 1000;
        return (productsHandled * 1000) / volumeTierThreshold;
    }

    /// @notice Calculate tenure component score (0-1000)
    function _calculateTenureScore(uint256 registeredAt) internal view returns (uint256) {
        uint256 tenure = block.timestamp - registeredAt;
        if (tenure >= tenureTierThreshold) return 1000;
        return (tenure * 1000) / tenureTierThreshold;
    }

    /// @notice Calculate response time component score (0-1000)
    function _calculateResponseTimeScore(uint256 avgResponseTime) internal view returns (uint256) {
        if (avgResponseTime == 0) return 500; // Neutral for no data
        if (avgResponseTime <= optimalResponseTime) return 1000;
        
        // Score decreases as response time exceeds optimal
        // If response time is 2x optimal, score is 500
        // If response time is 3x+ optimal, score is 0
        if (avgResponseTime >= optimalResponseTime * 3) return 0;
        
        uint256 excessTime = avgResponseTime - optimalResponseTime;
        uint256 penaltyRange = optimalResponseTime * 2;
        return 1000 - (excessTime * 1000) / penaltyRange;
    }

    /// @notice Calculate dispute history component score (0-1000)
    function _calculateDisputeScore(uint256 totalDisputes, uint256 disputesLost) internal pure returns (uint256) {
        if (totalDisputes == 0) return 1000; // Perfect score for no disputes
        uint256 disputeWinRate = ((totalDisputes - disputesLost) * 100) / totalDisputes;
        return (disputeWinRate * 10); // Convert percentage to 0-1000 scale
    }

    /// @notice Calculate consistency bonus score (0-1000)
    function _calculateConsistencyScore(uint256 consecutiveSuccesses) internal view returns (uint256) {
        if (consecutiveSuccesses < consistencyThreshold) {
            return (consecutiveSuccesses * 1000) / consistencyThreshold;
        }
        return 1000; // Max bonus for meeting threshold
    }

    /// @notice Calculate decay multiplier based on inactivity (0-100%)
    function _calculateDecayMultiplier(uint256 lastActivity) internal view returns (uint256) {
        uint256 inactivePeriod = block.timestamp - lastActivity;
        
        if (inactivePeriod < reputationDecayPeriod) return 100; // No decay
        
        uint256 decayPeriods = inactivePeriod / reputationDecayPeriod;
        
        // Calculate decay: 5% per period, minimum 50%
        uint256 totalDecay = decayPeriods * decayRatePercent;
        if (totalDecay > 50) totalDecay = 50; // Cap decay at 50%
        
        return 100 - totalDecay;
    }

    function isAuthorizedRetailer(
        address brand,
        address retailer
    ) external view returns (bool) {
        return
            retailers[retailer].isAuthorized &&
            brandAuthorizations[brand][retailer];
    }

    /// @notice Get detailed reputation breakdown for a retailer
    /// @param retailer Address of the retailer
    /// @return successScore Success rate component score
    /// @return volumeScore Volume component score
    /// @return tenureScore Tenure component score
    /// @return responseScore Response time component score
    /// @return disputeScore Dispute history component score
    /// @return consistencyScore Consistency bonus score
    /// @return decayMultiplier Decay multiplier percentage
    /// @return compositeScore Final composite reputation score
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

    /// @notice Update reputation weight configuration
    /// @param newWeights New weight configuration
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

    /// @notice Update volume tier threshold
    function setVolumeTierThreshold(uint256 newThreshold) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newThreshold > 0, "Invalid threshold");
        volumeTierThreshold = newThreshold;
    }

    /// @notice Update tenure tier threshold
    function setTenureTierThreshold(uint256 newThreshold) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newThreshold > 0, "Invalid threshold");
        tenureTierThreshold = newThreshold;
    }

    /// @notice Update optimal response time
    function setOptimalResponseTime(uint256 newTime) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newTime > 0, "Invalid time");
        optimalResponseTime = newTime;
    }

    /// @notice Update consistency threshold
    function setConsistencyThreshold(uint256 newThreshold) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newThreshold > 0, "Invalid threshold");
        consistencyThreshold = newThreshold;
    }

    /// @notice Update reputation decay parameters
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
