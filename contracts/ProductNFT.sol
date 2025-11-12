// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ProductRegistry.sol";
import "./RetailerRegistry.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ERC-721 NFT for authenticated products with transfer restrictions
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

    // Minting functions

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
        (, , address currentOwner, , , , , ) = productRegistry.products(
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

    // Override _update to implement transfer restrictions
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

    // Check if address is authorized to receive NFTs
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

    // Record transfer with optional price
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

    // Record sale price for secondary market tracking
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

    // Admin functions

    // Enable or disable transfer restrictions
    function setTransferRestrictions(
        bool enabled
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        transferRestrictionsEnabled = enabled;
        emit TransferRestrictionUpdated(enabled);
    }

    // Enable or disable retailer authorization requirement
    function setRetailerAuthorizationRequirement(
        bool required
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        requireRetailerAuthorization = required;
        emit RetailerAuthorizationRequirementUpdated(required);
    }

    // Whitelist or remove address
    function setWhitelistedAddress(
        address account,
        bool whitelisted
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address");
        whitelistedAddresses[account] = whitelisted;
        emit AddressWhitelisted(account, whitelisted);
    }

    // Batch whitelist multiple addresses

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

    // Update royalty information

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

    // View functions

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        bytes32 productId = nftToProductId[tokenId];
        (, , , , , string memory metadataURI, , ) = productRegistry.products(
            productId
        );

        return metadataURI;
    }

    // Get transfer history for token
    function getTransferHistory(
        uint256 tokenId
    ) external view returns (TransferRecord[] memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return transferHistory[tokenId];
    }

    // Get token transfer count
    function getTransferCount(uint256 tokenId) external view returns (uint256) {
        return transferHistory[tokenId].length;
    }

    // Check if address can receive NFT
    function canReceiveNFT(
        address recipient,
        uint256 tokenId
    ) external view returns (bool) {
        if (!transferRestrictionsEnabled) {
            return true;
        }
        return _isAuthorizedRecipient(recipient, tokenId);
    }

    // Get royalty information for a token (EIP-2981)

    function royaltyInfo(
        uint256 tokenId,
        uint256 salePrice
    ) external view returns (address receiver, uint256 royaltyAmount) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        receiver = royaltyReceiver;
        royaltyAmount = (salePrice * royaltyPercentage) / 10000;
    }

    // Get the product ID associated with an NFT

    function getProductId(uint256 tokenId) external view returns (bytes32) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return nftToProductId[tokenId];
    }

    // Check if a product has an associated NFT

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
