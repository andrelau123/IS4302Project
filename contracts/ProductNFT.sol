// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol"

contract ProductNFT is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    ProductRegistry public productRegistry;

    uint256 private _tokenIdCounter;

    mapping(uint256 => bytes32) public nftToProductId;
    mapping(bytes32 => uint256) public productIdToNFT;

    event ProductNFTMinted(
        uint256 indexed tokenId,
        bytes32 indexed productId,
        address owner
    );

    constructor(
        address _productRegistry
    ) ERC721("Authentic Product NFT", "AUTH-NFT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        productRegistry = ProductRegistry(_productRegistry);
    }

    function mintProductNFT(
        bytes32 productId,
        address owner
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(productIdToNFT[productId] == 0, "NFT already exists");
        require(
            productRegistry.isAuthentic(productId),
            "Product not authentic"
        );

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(owner, tokenId);

        nftToProductId[tokenId] = productId;
        productIdToNFT[productId] = tokenId;

        emit ProductNFTMinted(tokenId, productId, owner);

        return tokenId;
    }

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

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
