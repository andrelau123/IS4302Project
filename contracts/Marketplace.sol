// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ProductNFT.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Marketplace
 * Simple marketplace for buying and selling ProductNFTs with ETH
 */
contract Marketplace is ReentrancyGuard, Ownable {
    ProductNFT public productNFT;
    
    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
    }
    
    // tokenId => Listing
    mapping(uint256 => Listing) public listings;
    
    // Platform fee (in basis points, e.g., 250 = 2.5%)
    uint256 public platformFeeBps = 250;
    address public feeRecipient;
    
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Purchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);
    event Cancelled(uint256 indexed tokenId, address indexed seller);
    event PriceUpdated(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice);
    
    constructor(address _productNFT, address _feeRecipient) Ownable(msg.sender) {
        require(_productNFT != address(0), "Invalid NFT address");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        productNFT = ProductNFT(_productNFT);
        feeRecipient = _feeRecipient;
    }
    
    /**
     * List an NFT for sale
     * tokenId The token ID to list
     * price The price in wei
     */
    function createListing(uint256 tokenId, uint256 price) external {
        require(productNFT.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(price > 0, "Price must be > 0");
        require(!listings[tokenId].active, "Already listed");
        
        // Transfer NFT to marketplace
        productNFT.transferFrom(msg.sender, address(this), tokenId);
        
        listings[tokenId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            active: true
        });
        
        emit Listed(tokenId, msg.sender, price);
    }
    
    /**
     * Purchase an NFT
     * tokenId The token ID to purchase
     */
    function purchaseNFT(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(msg.value >= listing.price, "Insufficient payment");
        
        uint256 platformFee = (listing.price * platformFeeBps) / 10000;
        uint256 sellerAmount = listing.price - platformFee;
        
        // Mark as inactive before transfers (reentrancy protection)
        listing.active = false;
        
        // Transfer NFT to buyer
        productNFT.transferFrom(address(this), msg.sender, tokenId);
        
        // Pay seller
        (bool sellerSuccess, ) = payable(listing.seller).call{value: sellerAmount}("");
        require(sellerSuccess, "Seller payment failed");
        
        // Pay platform fee
        if (platformFee > 0) {
            (bool feeSuccess, ) = payable(feeRecipient).call{value: platformFee}("");
            require(feeSuccess, "Fee payment failed");
        }
        
        // Refund excess payment
        if (msg.value > listing.price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - listing.price}("");
            require(refundSuccess, "Refund failed");
        }
        
        emit Purchased(tokenId, msg.sender, listing.seller, listing.price);
    }
    
    /**
     * Cancel a listing
     * tokenId The token ID to cancel
     */
    function cancelListing(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(listing.seller == msg.sender, "Not seller");
        
        listing.active = false;
        
        // Return NFT to seller
        productNFT.transferFrom(address(this), msg.sender, tokenId);
        
        emit Cancelled(tokenId, msg.sender);
    }
    
    /**
     * Update listing price
     * tokenId The token ID
     * newPrice The new price
     */
    function updatePrice(uint256 tokenId, uint256 newPrice) external {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(listing.seller == msg.sender, "Not seller");
        require(newPrice > 0, "Price must be > 0");
        
        uint256 oldPrice = listing.price;
        listing.price = newPrice;
        
        emit PriceUpdated(tokenId, oldPrice, newPrice);
    }
    
    /**
     * Update platform fee
     * newFeeBps New fee in basis points
     */
    function updatePlatformFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high"); // Max 10%
        platformFeeBps = newFeeBps;
    }
    
    /**
     * Update fee recipient
     * newRecipient New fee recipient address
     */
    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid address");
        feeRecipient = newRecipient;
    }
    
    /**
     * Get listing details
     * tokenId The token ID
     */
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }
    
    /**
     * Check if token is listed
     * tokenId The token ID
     */
    function isListed(uint256 tokenId) external view returns (bool) {
        return listings[tokenId].active;
    }
}

