// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RetailerRegistry.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Core registry for authentic products with full lifecycle and verification tracking.
contract ProductRegistry is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant REGISTRY_ADMIN_ROLE =
        keccak256("REGISTRY_ADMIN_ROLE");

    RetailerRegistry public immutable retailerRegistry;

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
        string metadataURI; // IPFS CID or HTTPS link
        bool exists;
        bool isVerified; // Track verification status
    }

    struct TransferEvent {
        address from;
        address to;
        uint256 timestamp;
        string location; // physical or logistical checkpoint
        bytes32 verificationHash; // proof from VerificationManager
    }

    mapping(bytes32 => Product) public products;
    mapping(bytes32 => TransferEvent[]) private productHistory;

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
    event MetadataUpdated(bytes32 indexed productId, string newMetadataURI);

    constructor(address _retailerRegistry, address admin) {
        require(_retailerRegistry != address(0), "Zero registry");
        retailerRegistry = RetailerRegistry(_retailerRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRY_ADMIN_ROLE, admin);
    }

    function registerProduct(
        string calldata metadataURI
    ) external onlyRole(MANUFACTURER_ROLE) whenNotPaused returns (bytes32) {
        require(bytes(metadataURI).length > 0, "Empty metadata URI");
        bytes32 productId = keccak256(
            abi.encodePacked(msg.sender, metadataURI, block.timestamp)
        );
        require(!products[productId].exists, "Product already exists");

        products[productId] = Product({
            productId: productId,
            manufacturer: msg.sender,
            currentOwner: msg.sender,
            status: ProductStatus.Registered,
            registeredAt: block.timestamp,
            metadataURI: metadataURI,
            exists: true,
            isVerified: false
        });

        // Record initial registration event
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
        return productId;
    }

    function transferProduct(
        bytes32 productId,
        address to,
        string calldata location,
        bytes32 verificationHash
    ) external nonReentrant whenNotPaused {
        Product storage p = products[productId];
        require(p.exists, "Not found");
        require(p.currentOwner == msg.sender, "Not owner");
        require(to != address(0), "Invalid address");

        bool isManufacturer = hasRole(MANUFACTURER_ROLE, to) &&
            to == p.manufacturer;
        bool isAuthorizedRetailer = retailerRegistry.isAuthorizedRetailer(
            p.manufacturer,
            to
        );

        require(
            isAuthorizedRetailer || isManufacturer,
            "Unauthorized retailer"
        );

        p.currentOwner = to;

        // Only change status to InTransit if not disputed
        if (p.status != ProductStatus.Disputed) {
            p.status = ProductStatus.InTransit;
        }

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

        // Only emit status change if status actually changed
        if (p.status != ProductStatus.Disputed) {
            emit ProductStatusChanged(productId, ProductStatus.InTransit);
        }
    }

    /// Confirm receipt of product at destination
    function confirmReceipt(
        bytes32 productId
    ) external nonReentrant whenNotPaused {
        Product storage p = products[productId];
        require(p.exists, "Not found");
        require(p.currentOwner == msg.sender, "Not owner");
        require(
            p.status == ProductStatus.InTransit ||
                p.status == ProductStatus.Disputed,
            "Product not in transit"
        );

        // Only change status to AtRetailer if not disputed
        if (p.status != ProductStatus.Disputed) {
            p.status = ProductStatus.AtRetailer;
        }

        // Record receipt in history
        productHistory[productId].push(
            TransferEvent({
                from: msg.sender,
                to: msg.sender,
                timestamp: block.timestamp,
                location: "Retailer Location - Receipt Confirmed",
                verificationHash: keccak256(
                    abi.encodePacked(productId, msg.sender, block.timestamp)
                )
            })
        );

        // Only emit status change if status actually changed
        if (p.status != ProductStatus.Disputed) {
            emit ProductStatusChanged(productId, ProductStatus.AtRetailer);
        }
    }

    /// Mark a product as sold to final customer
    function markAsSold(
        bytes32 productId,
        address customer
    ) external nonReentrant whenNotPaused {
        Product storage p = products[productId];
        require(p.exists, "Product not found");
        require(p.currentOwner == msg.sender, "Not product owner");
        require(
            p.status == ProductStatus.AtRetailer,
            "Product must be at retailer"
        );
        require(customer != address(0), "Invalid customer address");

        p.status = ProductStatus.Sold;
        p.currentOwner = customer; // Transfer ownership to customer

        // Record sale in history
        productHistory[productId].push(
            TransferEvent({
                from: msg.sender,
                to: customer,
                timestamp: block.timestamp,
                location: "Sold to Customer",
                verificationHash: keccak256(
                    abi.encodePacked(productId, customer, block.timestamp)
                )
            })
        );

        emit ProductTransferred(
            productId,
            msg.sender,
            customer,
            block.timestamp
        );
        emit ProductStatusChanged(productId, ProductStatus.Sold);
    }

    /// Mark a product as disputed (called by DisputeResolution contract)
    function markAsDisputed(
        bytes32 productId
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        Product storage p = products[productId];
        require(p.exists, "Product not found");

        // Mark as disputed
        p.status = ProductStatus.Disputed;

        emit ProductStatusChanged(productId, ProductStatus.Disputed);
    }

    /// Clear disputed status and restore to appropriate status
    function clearDisputed(
        bytes32 productId
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        Product storage p = products[productId];
        require(p.exists, "Product not found");
        require(p.status == ProductStatus.Disputed, "Not disputed");

        // Determine appropriate status based on owner and history
        ProductStatus newStatus;

        // Check if product was sold (owner is not manufacturer or retailer)
        bool isManufacturer = hasRole(MANUFACTURER_ROLE, p.currentOwner) &&
            p.currentOwner == p.manufacturer;
        bool isRetailer = retailerRegistry.isAuthorizedRetailer(
            p.manufacturer,
            p.currentOwner
        );

        if (!isManufacturer && !isRetailer) {
            newStatus = ProductStatus.Sold;
        } else if (isRetailer) {
            newStatus = ProductStatus.AtRetailer;
        } else {
            newStatus = ProductStatus.Registered;
        }

        p.status = newStatus;
        emit ProductStatusChanged(productId, newStatus);
    }

    function updateProductStatus(
        bytes32 productId,
        ProductStatus newStatus
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        Product storage p = products[productId];
        require(p.exists, "Not found");
        require(isValidTransition(p.status, newStatus), "Invalid transition");

        p.status = newStatus;
        emit ProductStatusChanged(productId, newStatus);
    }

    // verification Hooks
    /// Called by VerificationManager after successful authenticity check.
    /// Also used by DisputeResolution to flip verification status.
    function recordVerification(
        bytes32 productId,
        bytes32 verificationHash
    ) external onlyRole(VERIFIER_ROLE) {
        require(products[productId].exists, "Invalid ID");

        Product storage p = products[productId];

        // Flip the verification status
        p.isVerified = !p.isVerified;

        productHistory[productId].push(
            TransferEvent({
                from: p.currentOwner,
                to: p.currentOwner,
                timestamp: block.timestamp,
                location: "Verification Node",
                verificationHash: verificationHash
            })
        );
        emit VerificationRecorded(productId, verificationHash);
    }

    function getProduct(
        bytes32 productId
    ) external view returns (Product memory) {
        return products[productId];
    }

    function getProductHistory(
        bytes32 productId
    ) external view returns (TransferEvent[] memory) {
        return productHistory[productId];
    }

    function getBrandOwner(bytes32 productId) external view returns (address) {
        return products[productId].manufacturer;
    }

    function isAuthentic(bytes32 productId) external view returns (bool) {
        return
            products[productId].exists &&
            products[productId].status != ProductStatus.Disputed;
    }

    // admin functions
    function updateMetadataURI(
        bytes32 productId,
        string calldata newURI
    ) external whenNotPaused {
        Product storage p = products[productId];
        require(p.exists, "Not found");
        require(
            p.manufacturer == msg.sender ||
                hasRole(REGISTRY_ADMIN_ROLE, msg.sender),
            "Unauthorized"
        );
        require(bytes(newURI).length > 0, "Empty URI");
        p.metadataURI = newURI;
        emit MetadataUpdated(productId, newURI);
    }

    function pause() external onlyRole(REGISTRY_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(REGISTRY_ADMIN_ROLE) {
        _unpause();
    }

    /// Check if a product is registered
    function isRegistered(bytes32 productId) external view returns (bool) {
        return products[productId].exists;
    }

    /// Update product status (for tests and manufacturer use)
    function updateStatus(
        bytes32 productId,
        ProductStatus newStatus
    ) external whenNotPaused {
        Product storage p = products[productId];
        require(p.exists, "Not found");
        require(
            p.currentOwner == msg.sender ||
                hasRole(MANUFACTURER_ROLE, msg.sender),
            "Not authorized"
        );
        require(isValidTransition(p.status, newStatus), "Invalid transition");

        p.status = newStatus;
        emit ProductStatusChanged(productId, newStatus);
    }

    /// Update product metadata (manufacturer only)
    function updateMetadata(
        bytes32 productId,
        string calldata newMetadataURI
    ) external whenNotPaused {
        Product storage p = products[productId];
        require(p.exists, "Not found");
        require(p.manufacturer == msg.sender, "Not manufacturer");

        p.metadataURI = newMetadataURI;
        emit MetadataUpdated(productId, newMetadataURI);
    }

    // helper functions
    function isValidTransition(
        ProductStatus from,
        ProductStatus to
    ) internal pure returns (bool) {
        if (from == ProductStatus.Registered && to == ProductStatus.InTransit)
            return true;
        if (from == ProductStatus.InTransit && to == ProductStatus.AtRetailer)
            return true;
        if (from == ProductStatus.AtRetailer && to == ProductStatus.Sold)
            return true;
        if (to == ProductStatus.Disputed) return true; // Dispute can be raised from any state
        return false;
    }
}
