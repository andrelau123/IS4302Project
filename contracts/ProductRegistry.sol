// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RetailerRegistry.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ProductRegistry is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    enum ProductStatus {
        Registered,
        InTransit,
        AtRetailer,
        Sold,
        Disputed
    }

    struct Product {
        bytes32 productId;
        address manufacturer;
        address currentOwner;
        ProductStatus status;
        uint256 registeredAt;
        string metadataURI; // IPFS hash
        bool exists;
    }

    struct TransferEvent {
        address from;
        address to;
        uint256 timestamp;
        string location;
        bytes32 verificationHash;
    }

    mapping(bytes32 => Product) public products;
    mapping(bytes32 => TransferEvent[]) public productHistory;
    mapping(bytes32 => mapping(address => bool)) public verifiedTransfers;

    RetailerRegistry public retailerRegistry;

    event ProductRegistered(
        bytes32 indexed productId,
        address indexed manufacturer,
        string metadataURI
    );
    event ProductTransferred(
        bytes32 indexed productId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );
    event ProductStatusChanged(
        bytes32 indexed productId,
        ProductStatus newStatus
    );
    event VerificationRecorded(
        bytes32 indexed productId,
        bytes32 verificationHash
    );

    constructor(address _retailerRegistry) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANUFACTURER_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        retailerRegistry = RetailerRegistry(_retailerRegistry);
    }

    function registerProduct(
        bytes32 productId,
        string calldata metadataURI
    ) external onlyRole(MANUFACTURER_ROLE) whenNotPaused {
        require(!products[productId].exists, "Product already registered");

        products[productId] = Product({
            productId: productId,
            manufacturer: msg.sender,
            currentOwner: msg.sender,
            status: ProductStatus.Registered,
            registeredAt: block.timestamp,
            metadataURI: metadataURI,
            exists: true
        });

        // Record initial "transfer" event
        productHistory[productId].push(
            TransferEvent({
                from: address(0),
                to: msg.sender,
                timestamp: block.timestamp,
                location: "Manufacturing Facility",
                verificationHash: keccak256(
                    abi.encodePacked(productId, msg.sender, block.timestamp)
                )
            })
        );

        emit ProductRegistered(productId, msg.sender, metadataURI);
    }

    function transferProduct(
        bytes32 productId,
        address to,
        string calldata location,
        bytes32 verificationHash
    ) external nonReentrant whenNotPaused {
        Product storage product = products[productId];
        require(product.exists, "Product does not exist");
        require(product.currentOwner == msg.sender, "Not current owner");
        require(to != address(0), "Invalid recipient");

        product.currentOwner = to;
        product.status = ProductStatus.InTransit;

        productHistory[productId].push(
            TransferEvent({
                from: msg.sender,
                to: to,
                timestamp: block.timestamp,
                location: location,
                verificationHash: verificationHash
            })
        );

        emit ProductTransferred(productId, msg.sender, to, block.timestamp);
        emit ProductStatusChanged(productId, ProductStatus.InTransit);
    }

    function updateProductStatus(
        bytes32 productId,
        ProductStatus newStatus
    ) external onlyRole(VERIFIER_ROLE) {
        Product storage product = products[productId];
        require(product.exists, "Product does not exist");

        product.status = newStatus;
        emit ProductStatusChanged(productId, newStatus);
    }

    function recordVerification(
        bytes32 productId,
        bytes32 verificationHash
    ) external onlyRole(VERIFIER_ROLE) {
        require(products[productId].exists, "Product does not exist");
        verifiedTransfers[productId][msg.sender] = true;
        emit VerificationRecorded(productId, verificationHash);
    }

    function getProductHistory(
        bytes32 productId
    ) external view returns (TransferEvent[] memory) {
        return productHistory[productId];
    }

    function isAuthentic(bytes32 productId) external view returns (bool) {
        return
            products[productId].exists &&
            products[productId].status != ProductStatus.Disputed;
    }
}
