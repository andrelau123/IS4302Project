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
        uint256 reputationScore;
        uint256 totalVerifications;
        uint256 failedVerifications;
        uint256 registeredAt;
    }

    mapping(address => Retailer) public retailers;
    mapping(address => mapping(address => bool)) public brandAuthorizations;

    event RetailerRegistered(address indexed retailer, string name);
    event RetailerAuthorized(address indexed brand, address indexed retailer);
    event RetailerDeauthorized(address indexed brand, address indexed retailer);
    event ReputationUpdated(address indexed retailer, uint256 newScore);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRAND_MANAGER_ROLE, msg.sender);
    }

    function registerRetailer(
        address retailerAddress,
        string calldata name
    ) external onlyRole(BRAND_MANAGER_ROLE) {
        require(!retailers[retailerAddress].isAuthorized, "Already registered");

        retailers[retailerAddress] = Retailer({
            isAuthorized: true,
            retailerAddress: retailerAddress,
            name: name,
            reputationScore: 100,
            totalVerifications: 0,
            failedVerifications: 0,
            registeredAt: block.timestamp
        });

        emit RetailerRegistered(retailerAddress, name);
    }

    function authorizeRetailerForBrand(
        address brand,
        address retailer
    ) external onlyRole(BRAND_MANAGER_ROLE) {
        require(retailers[retailer].isAuthorized, "Retailer not registered");
        brandAuthorizations[brand][retailer] = true;
        emit RetailerAuthorized(brand, retailer);
    }

    function deauthorizeRetailerForBrand(
        address brand,
        address retailer
    ) external onlyRole(BRAND_MANAGER_ROLE) {
        brandAuthorizations[brand][retailer] = false;
        emit RetailerDeauthorized(brand, retailer);
    }

    function updateReputation(
        address retailer,
        bool success
    ) external onlyRole(BRAND_MANAGER_ROLE) {
        Retailer storage r = retailers[retailer];
        require(r.isAuthorized, "Retailer not registered");

        r.totalVerifications++;
        if (!success) {
            r.failedVerifications++;
        }

        if (r.totalVerifications > 0) {
            uint256 successRate = ((r.totalVerifications -
                r.failedVerifications) * 100) / r.totalVerifications;
            r.reputationScore = successRate;
        }

        emit ReputationUpdated(retailer, r.reputationScore);
    }

    function isAuthorizedRetailer(
        address brand,
        address retailer
    ) external view returns (bool) {
        return
            retailers[retailer].isAuthorized &&
            brandAuthorizations[brand][retailer];
    }
}
