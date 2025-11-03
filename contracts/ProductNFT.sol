// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ProductRegistry.sol";
import "./RetailerRegistry.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ProductNFT
 * @notice ERC-721 NFT for premium authenticated products with transfer restrictions
 * @dev Implements transfer restrictions to maintain supply chain authenticity
 *      Only authorized retailers or verified addresses can receive NFTs
 */
contract ProductNFT is ERC721, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TRANSFER_VALIDATOR_ROLE =
        keccak256("TRANSFER_VALIDATOR_ROLE");

    ProductRegistry public immutable productRegistry;
    RetailerRegistry public immutable retailerRegistry;

    uint256 private _tokenIdCounter;

    // Transfer restriction settings
    bool public transferRestrictionsEnabled = true;
    bool public requireRetailerAuthorization = true;

    // Whitelisted addresses that can always receive NFTs (e.g., marketplaces, escrow)
    mapping(address => bool) public whitelistedAddresses;

    // Track transfer history for secondary market analytics
    struct TransferRecord {
        address from;
        address to;
        uint256 timestamp;
        uint256 price; // Optional: for secondary market tracking
    }

    mapping(uint256 => bytes32) public nftToProductId;
    mapping(bytes32 => uint256) public productIdToNFT;
    mapping(uint256 => TransferRecord[]) public transferHistory;

    // Royalty info for secondary sales (EIP-2981 compatible)
    uint256 public royaltyPercentage = 250; // 2.5% in basis points
    address public royaltyReceiver;

    event ProductNFTMinted(
        uint256 indexed tokenId,
        bytes32 indexed productId,
        address owner
    );
    event TransferRestrictionUpdated(bool enabled);
    event RetailerAuthorizationRequirementUpdated(bool required);
    event AddressWhitelisted(address indexed account, bool whitelisted);
    event TransferRecorded(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 timestamp,
        uint256 price
    );
    event RoyaltyInfoUpdated(address receiver, uint256 percentage);

    constructor(
        address _productRegistry,
        address _retailerRegistry
    ) ERC721("Authentic Product NFT", "AUTH-NFT") {
        require(_productRegistry != address(0), "Invalid ProductRegistry");
        require(_retailerRegistry != address(0), "Invalid RetailerRegistry");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(TRANSFER_VALIDATOR_ROLE, msg.sender);

        productRegistry = ProductRegistry(_productRegistry);
        retailerRegistry = RetailerRegistry(_retailerRegistry);
        royaltyReceiver = msg.sender;
    }

    // ==================== Minting Functions ====================

    function mintProductNFT(
        bytes32 productId,
        address owner
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(productIdToNFT[productId] == 0, "NFT already exists");
        require(
            productRegistry.isAuthentic(productId),
            "Product not authentic"
        );

        // Get product details to check current owner
        (, , address currentOwner, , , , ) = productRegistry.products(
            productId
        );

        require(
            currentOwner == msg.sender,
            "Only current product owner can mint NFT"
        );

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(owner, tokenId);

        nftToProductId[tokenId] = productId;
        productIdToNFT[productId] = tokenId;

        // Initialize transfer history
        transferHistory[tokenId].push(
            TransferRecord({
                from: address(0),
                to: owner,
                timestamp: block.timestamp,
                price: 0
            })
        );

        emit ProductNFTMinted(tokenId, productId, owner);

        return tokenId;
    }

    // ==================== Transfer Restriction Functions ====================

    /**
     * @notice Override _update to implement transfer restrictions
     * @dev Checks if recipient is authorized before allowing transfer
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override whenNotPaused returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (from == address(0)) and burning (to == address(0))
        if (from != address(0) && to != address(0)) {
            // Check transfer restrictions
            if (transferRestrictionsEnabled) {
                require(
                    _isAuthorizedRecipient(to, tokenId),
                    "Recipient not authorized"
                );
            }

            // Record transfer in history
            _recordTransfer(tokenId, from, to, 0);
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Check if an address is authorized to receive NFTs
     * @param recipient Address to check
     * @param tokenId Token being transferred
     */
    function _isAuthorizedRecipient(
        address recipient,
        uint256 tokenId
    ) internal view returns (bool) {
        // Always allow whitelisted addresses (marketplaces, escrow contracts)
        if (whitelistedAddresses[recipient]) {
            return true;
        }

        // Always allow current owner (should not happen but safe check)
        if (recipient == _ownerOf(tokenId)) {
            return true;
        }

        // Allow transfers from addresses with TRANSFER_VALIDATOR_ROLE (marketplaces)
        // This allows marketplace contracts to transfer to any buyer
        address currentOwner = _ownerOf(tokenId);
        if (hasRole(TRANSFER_VALIDATOR_ROLE, currentOwner)) {
            return true;
        }

        // If retailer authorization is required
        if (requireRetailerAuthorization) {
            bytes32 productId = nftToProductId[tokenId];
            address brand = productRegistry.getBrandOwner(productId);

            // Check if recipient is an authorized retailer for this brand
            return retailerRegistry.isAuthorizedRetailer(brand, recipient);
        }

        // If no restrictions, allow all transfers
        return true;
    }

    /**
     * @notice Record a transfer with optional price information
     * @param tokenId Token being transferred
     * @param from Sender address
     * @param to Recipient address
     * @param price Sale price (0 if not a sale)
     */
    function _recordTransfer(
        uint256 tokenId,
        address from,
        address to,
        uint256 price
    ) internal {
        transferHistory[tokenId].push(
            TransferRecord({
                from: from,
                to: to,
                timestamp: block.timestamp,
                price: price
            })
        );

        emit TransferRecorded(tokenId, from, to, block.timestamp, price);
    }

    /**
     * @notice Record sale price for secondary market tracking
     * @dev Can be called by marketplace integrations or transfer validators
     * @param tokenId Token that was sold
     * @param price Sale price in wei
     */
    function recordSalePrice(
        uint256 tokenId,
        uint256 price
    ) external onlyRole(TRANSFER_VALIDATOR_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(price > 0, "Price must be positive");

        // Update the last transfer record with price
        TransferRecord[] storage history = transferHistory[tokenId];
        if (history.length > 0) {
            history[history.length - 1].price = price;
        }
    }

    // ==================== Admin Functions ====================

    /**
     * @notice Enable or disable transfer restrictions
     * @param enabled Whether restrictions should be enabled
     */
    function setTransferRestrictions(
        bool enabled
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        transferRestrictionsEnabled = enabled;
        emit TransferRestrictionUpdated(enabled);
    }

    /**
     * @notice Enable or disable retailer authorization requirement
     * @param required Whether retailer authorization is required
     */
    function setRetailerAuthorizationRequirement(
        bool required
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        requireRetailerAuthorization = required;
        emit RetailerAuthorizationRequirementUpdated(required);
    }

    /**
     * @notice Whitelist or remove an address from whitelist
     * @param account Address to whitelist/remove
     * @param whitelisted Whether to whitelist or remove
     */
    function setWhitelistedAddress(
        address account,
        bool whitelisted
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address");
        whitelistedAddresses[account] = whitelisted;
        emit AddressWhitelisted(account, whitelisted);
    }

    /**
     * @notice Batch whitelist multiple addresses
     * @param accounts Array of addresses to whitelist
     * @param whitelisted Whether to whitelist or remove all
     */
    function batchSetWhitelistedAddresses(
        address[] calldata accounts,
        bool whitelisted
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "Invalid address");
            whitelistedAddresses[accounts[i]] = whitelisted;
            emit AddressWhitelisted(accounts[i], whitelisted);
        }
    }

    /**
     * @notice Update royalty information
     * @param receiver Address to receive royalties
     * @param percentage Royalty percentage in basis points (e.g., 250 = 2.5%)
     */
    function setRoyaltyInfo(
        address receiver,
        uint256 percentage
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(receiver != address(0), "Invalid receiver");
        require(percentage <= 1000, "Royalty too high"); // Max 10%

        royaltyReceiver = receiver;
        royaltyPercentage = percentage;

        emit RoyaltyInfoUpdated(receiver, percentage);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ==================== View Functions ====================

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        bytes32 productId = nftToProductId[tokenId];
        (, , , , , string memory metadataURI, ) = productRegistry.products(
            productId
        );

        return metadataURI;
    }

    /**
     * @notice Get full transfer history for a token
     * @param tokenId Token to query
     * @return Array of transfer records
     */
    function getTransferHistory(
        uint256 tokenId
    ) external view returns (TransferRecord[] memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return transferHistory[tokenId];
    }

    /**
     * @notice Get the number of times a token has been transferred
     * @param tokenId Token to query
     * @return Number of transfers
     */
    function getTransferCount(uint256 tokenId) external view returns (uint256) {
        return transferHistory[tokenId].length;
    }

    /**
     * @notice Check if an address can receive a specific NFT
     * @param recipient Address to check
     * @param tokenId Token being checked
     * @return Whether the recipient is authorized
     */
    function canReceiveNFT(
        address recipient,
        uint256 tokenId
    ) external view returns (bool) {
        if (!transferRestrictionsEnabled) {
            return true;
        }
        return _isAuthorizedRecipient(recipient, tokenId);
    }

    /**
     * @notice Get royalty information for a token (EIP-2981)
     * @param tokenId Token to query
     * @param salePrice Sale price of the token
     * @return receiver Address to receive royalties
     * @return royaltyAmount Amount of royalty to pay
     */
    function royaltyInfo(
        uint256 tokenId,
        uint256 salePrice
    ) external view returns (address receiver, uint256 royaltyAmount) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        receiver = royaltyReceiver;
        royaltyAmount = (salePrice * royaltyPercentage) / 10000;
    }

    /**
     * @notice Get the product ID associated with an NFT
     * @param tokenId Token to query
     * @return Product ID
     */
    function getProductId(uint256 tokenId) external view returns (bytes32) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return nftToProductId[tokenId];
    }

    /**
     * @notice Check if a product has an associated NFT
     * @param productId Product to check
     * @return Whether NFT exists
     */
    function hasNFT(bytes32 productId) external view returns (bool) {
        return productIdToNFT[productId] != 0;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        // EIP-2981 interface ID
        return
            interfaceId == 0x2a55205a || super.supportsInterface(interfaceId);
    }
}
