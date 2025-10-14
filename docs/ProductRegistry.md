# ProductRegistry Contract Documentation

## Overview

**ProductRegistry** is the core contract for registering and tracking authentic products throughout their supply chain lifecycle. It maintains product identity, ownership, transfer history, and verification status.

**Contract:** `contracts/ProductRegistry.sol`  
**Standard:** AccessControl, Pausable, ReentrancyGuard  
**Purpose:** Product authentication and lifecycle management

## Purpose

The ProductRegistry contract provides:
- Unique product registration for manufacturers
- Product ownership tracking
- Transfer history with location data
- Status management (Registered → InTransit → AtRetailer → Sold)
- Integration with RetailerRegistry for authorization
- Verification recording

## Product Lifecycle States

```
Registered → InTransit → AtRetailer → Sold
     ↓           ↓            ↓          ↓
     └───────────→ Disputed ←────────────┘
```

**ProductStatus Enum:**
- **Registered**: Initial state after manufacturing
- **InTransit**: Product in transit to retailer/destination
- **AtRetailer**: Product at authorized retail location
- **Sold**: Final sale to consumer completed
- **Disputed**: Contested authenticity or ownership

## Core Data Structures

### Product Structure
```solidity
struct Product {
    bytes32 productId;          // Unique identifier
    address manufacturer;       // Original creator
    address currentOwner;       // Current holder
    ProductStatus status;       // Lifecycle status
    uint256 registeredAt;       // Registration timestamp
    string metadataURI;         // IPFS/HTTP metadata link
    bool exists;                // Existence flag
}
```

### Transfer Event Structure
```solidity
struct TransferEvent {
    address from;               // Previous owner
    address to;                 // New owner
    uint256 timestamp;          // Transfer time
    string location;            // Physical/logistical checkpoint
    bytes32 verificationHash;   // Proof from VerificationManager
}
```

## Core Functions

### Product Registration

**registerProduct(string metadataURI)**
```solidity
function registerProduct(string calldata metadataURI)
    external
    onlyRole(MANUFACTURER_ROLE)
    whenNotPaused
    returns (bytes32)
```
Registers a new authentic product. Returns unique product ID.

**Parameters:**
- `metadataURI`: IPFS CID or HTTPS link to product metadata

**Returns:**
- `bytes32`: Unique product identifier

### Product Transfer

**transferProduct(bytes32 productId, address to, string location, bytes32 verificationHash)**
```solidity
function transferProduct(
    bytes32 productId,
    address to,
    string calldata location,
    bytes32 verificationHash
) external nonReentrant whenNotPaused
```
Transfers product to authorized retailer. Validates recipient authorization.

**Requirements:**
- Caller must be current owner
- Recipient must be authorized retailer or manufacturer
- Product must exist

### Status Management

**updateProductStatus(bytes32 productId, ProductStatus newStatus)**
```solidity
function updateProductStatus(bytes32 productId, ProductStatus newStatus)
    external
    onlyRole(VERIFIER_ROLE)
    whenNotPaused
```
Updates product lifecycle status. Only valid transitions allowed.

**updateStatus(bytes32 productId, ProductStatus newStatus)**
```solidity
function updateStatus(bytes32 productId, ProductStatus newStatus)
    external
    whenNotPaused
```
Alternative status update for owner/manufacturer.

### Verification Recording

**recordVerification(bytes32 productId, bytes32 verificationHash)**
```solidity
function recordVerification(bytes32 productId, bytes32 verificationHash)
    external
    onlyRole(VERIFIER_ROLE)
```
Records verification event in product history.

### View Functions

**getProduct(bytes32 productId)**
```solidity
function getProduct(bytes32 productId)
    external
    view
    returns (Product memory)
```
Returns complete product information.

**getProductHistory(bytes32 productId)**
```solidity
function getProductHistory(bytes32 productId)
    external
    view
    returns (TransferEvent[] memory)
```
Returns complete transfer history.

**getBrandOwner(bytes32 productId)**
```solidity
function getBrandOwner(bytes32 productId)
    external
    view
    returns (address)
```
Returns original manufacturer address.

**isAuthentic(bytes32 productId)**
```solidity
function isAuthentic(bytes32 productId)
    external
    view
    returns (bool)
```
Checks if product exists and is not disputed.

**isRegistered(bytes32 productId)**
```solidity
function isRegistered(bytes32 productId)
    external
    view
    returns (bool)
```
Checks if product exists in registry.

## Valid Status Transitions

```
Registered → InTransit
InTransit → AtRetailer
AtRetailer → Sold
Any State → Disputed
```

**Invalid transitions are rejected.**

## Events

**ProductRegistered**
```solidity
event ProductRegistered(
    bytes32 indexed productId,
    address indexed manufacturer,
    string metadataURI
);
```

**ProductTransferred**
```solidity
event ProductTransferred(
    bytes32 indexed productId,
    address indexed from,
    address indexed to,
    uint256 timestamp
);
```

**ProductStatusChanged**
```solidity
event ProductStatusChanged(
    bytes32 indexed productId,
    ProductStatus newStatus
);
```

**VerificationRecorded**
```solidity
event VerificationRecorded(
    bytes32 indexed productId,
    bytes32 verificationHash
);
```

**MetadataUpdated**
```solidity
event MetadataUpdated(
    bytes32 indexed productId,
    string newMetadataURI
);
```

## Integration

### With RetailerRegistry
```solidity
// Validates transfer recipients
bool authorized = retailerRegistry.isAuthorizedRetailer(
    manufacturer,
    recipient
);
```

### With VerificationManager
```solidity
// Records verification results
productRegistry.recordVerification(productId, verificationHash);
```

### With ProductNFT
```solidity
// NFT minting requires authentic product
require(productRegistry.isAuthentic(productId), "Not authentic");
```

## Usage Examples

### Example 1: Register Product
```javascript
// Manufacturer registers new product
const metadataURI = "ipfs://QmX...";
const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
const receipt = await tx.wait();

// Extract product ID from event
const event = receipt.logs.find(log => 
    productRegistry.interface.parseLog(log).name === "ProductRegistered"
);
const productId = event.args[0];
console.log("Product ID:", productId);
```

### Example 2: Transfer to Retailer
```javascript
// Transfer product to authorized retailer
await productRegistry.connect(manufacturer).transferProduct(
    productId,
    retailerAddress,
    "Distribution Center A",
    verificationHash
);

// Check new owner
const product = await productRegistry.getProduct(productId);
console.log("Current owner:", product.currentOwner);
console.log("Status:", product.status); // InTransit
```

### Example 3: View Product History
```javascript
// Get complete transfer history
const history = await productRegistry.getProductHistory(productId);

history.forEach((transfer, index) => {
    console.log(`Transfer ${index}:`);
    console.log(`  From: ${transfer.from}`);
    console.log(`  To: ${transfer.to}`);
    console.log(`  Location: ${transfer.location}`);
    console.log(`  Time: ${new Date(transfer.timestamp * 1000)}`);
});
```

### Example 4: Update Status
```javascript
// Verifier updates product status
await productRegistry.connect(verifier).updateProductStatus(
    productId,
    ProductStatus.AtRetailer
);

// Manufacturer updates to sold
await productRegistry.connect(manufacturer).updateStatus(
    productId,
    ProductStatus.Sold
);
```

## Security Features

**Access Control**
- **MANUFACTURER_ROLE**: Register products
- **VERIFIER_ROLE**: Update status, record verifications
- **REGISTRY_ADMIN_ROLE**: Pause/unpause, grant roles

**Transfer Validation**
- Checks RetailerRegistry for authorization
- Verifies current ownership
- Prevents unauthorized transfers

**State Validation**
- Valid status transition enforcement
- Existence checks before operations
- Duplicate registration prevention

**Pausable**
- Emergency stop capability
- Admin-controlled pause/unpause

## Metadata Structure

IPFS metadata should contain:
```json
{
  "name": "Product Name",
  "description": "Product description",
  "brand": "Brand Name",
  "sku": "SKU123456",
  "manufacturing": {
    "date": "2024-01-01",
    "location": "Factory A",
    "batch": "BATCH001"
  },
  "authenticity": {
    "serial": "SN123456789",
    "certificate": "ipfs://..."
  },
  "image": "ipfs://..."
}
```

## Gas Costs

| Operation | Estimated Gas |
|-----------|---------------|
| Register Product | ~180,000 |
| Transfer Product | ~150,000 |
| Update Status | ~50,000 |
| Record Verification | ~100,000 |
| View Functions | <10,000 |

## Best Practices

**For Manufacturers:**
- Use descriptive metadata URIs
- Keep metadata immutable on IPFS
- Transfer only to authorized retailers
- Update metadata only when necessary

**For Verifiers:**
- Validate status transitions
- Include detailed verification hashes
- Update status promptly

**For Integrators:**
- Always check `isAuthentic()` before trusting product
- Monitor transfer history for anomalies
- Validate RetailerRegistry authorization

## Testing

**Test Coverage:** 28 tests
- Product registration
- Transfer authorization
- Status management
- Verification recording
- History tracking
- Edge cases

Run tests:
```bash
npx hardhat test test/ProductRegistry.test.js
```

## Contract Roles

**MANUFACTURER_ROLE**
- Register new products
- Transfer products
- Update metadata

**VERIFIER_ROLE**
- Update product status
- Record verifications

**REGISTRY_ADMIN_ROLE**
- Pause/unpause contract
- Grant/revoke roles
- Emergency controls

## Deployment

```javascript
const ProductRegistry = await ethers.getContractFactory("ProductRegistry");
const productRegistry = await ProductRegistry.deploy(
    retailerRegistryAddress,
    adminAddress
);
await productRegistry.waitForDeployment();

// Grant manufacturer role
await productRegistry.grantRole(MANUFACTURER_ROLE, manufacturerAddress);
```

## Version

**Version:** 1.0.0  
**Solidity:** ^0.8.20  
**Dependencies:** RetailerRegistry

## License

MIT License

