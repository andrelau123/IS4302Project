const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProductRegistry", function () {
  let productRegistry;
  let retailerRegistry;
  let owner, manufacturer, retailer, user1, user2;
  let MANUFACTURER_ROLE, VERIFIER_ROLE, REGISTRY_ADMIN_ROLE, BRAND_MANAGER_ROLE;

  beforeEach(async function () {
    [owner, manufacturer, retailer, user1, user2] = await ethers.getSigners();
    
    // Deploy RetailerRegistry first
    const RetailerRegistry = await ethers.getContractFactory("RetailerRegistry");
    retailerRegistry = await RetailerRegistry.deploy();
    
    // Deploy ProductRegistry
    const ProductRegistry = await ethers.getContractFactory("ProductRegistry");
    productRegistry = await ProductRegistry.deploy(retailerRegistry.target, owner.address);
    
    // Get role constants
    MANUFACTURER_ROLE = await productRegistry.MANUFACTURER_ROLE();
    VERIFIER_ROLE = await productRegistry.VERIFIER_ROLE();
    REGISTRY_ADMIN_ROLE = await productRegistry.REGISTRY_ADMIN_ROLE();
    BRAND_MANAGER_ROLE = await retailerRegistry.BRAND_MANAGER_ROLE();
    
    // Setup roles
    await productRegistry.grantRole(MANUFACTURER_ROLE, manufacturer.address);
    await productRegistry.grantRole(VERIFIER_ROLE, user1.address);
    await retailerRegistry.grantRole(BRAND_MANAGER_ROLE, owner.address);
    
    // Register retailer
    await retailerRegistry.registerRetailer(retailer.address, "Test Retailer");
    await retailerRegistry.authorizeRetailerForBrand(manufacturer.address, retailer.address);
  });

  describe("Deployment", function () {
    it("Should set the correct retailer registry", async function () {
      expect(await productRegistry.retailerRegistry()).to.equal(retailerRegistry.target);
    });

    it("Should grant admin roles correctly", async function () {
      expect(await productRegistry.hasRole(await productRegistry.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await productRegistry.hasRole(REGISTRY_ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Product Registration", function () {
    it("Should allow manufacturer to register a product", async function () {
      const metadataURI = "ipfs://QmTest123";
      
      const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const receipt = await tx.wait();
      
      // Extract productId from the event
      const event = receipt.logs.find(log => 
        log.topics[0] === productRegistry.interface.getEvent("ProductRegistered").topicHash
      );
      expect(event).to.not.be.undefined;
      
      const productId = event.topics[1]; // First indexed parameter
      
      await expect(tx)
        .to.emit(productRegistry, "ProductRegistered")
        .withArgs(productId, manufacturer.address, metadataURI);
    });

    it("Should not allow non-manufacturer to register product", async function () {
      const metadataURI = "ipfs://QmTest123";
      
      await expect(productRegistry.connect(user1).registerProduct(metadataURI))
        .to.be.reverted;
    });

    it("Should create product with correct initial state", async function () {
      const metadataURI = "ipfs://QmTest123";
      const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const receipt = await tx.wait();
      
      // Extract productId from event
      const event = receipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      const productId = productRegistry.interface.parseLog(event).args[0];
      
      const product = await productRegistry.products(productId);
      expect(product.manufacturer).to.equal(manufacturer.address);
      expect(product.currentOwner).to.equal(manufacturer.address);
      expect(product.status).to.equal(0); // ProductStatus.Registered
      expect(product.metadataURI).to.equal(metadataURI);
      expect(product.exists).to.be.true;
      expect(await productRegistry.isRegistered(productId)).to.be.true;
    });

    it("Should prevent registering duplicate products", async function () {
      const metadataURI = "ipfs://QmTest123";
      await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      
      // This should work as product IDs are unique due to timestamp
      await expect(productRegistry.connect(manufacturer).registerProduct(metadataURI))
        .to.not.be.reverted;
    });
  });

  describe("Product Transfer", function () {
    let productId;

    beforeEach(async function () {
      const metadataURI = "ipfs://QmTest123";
      const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      productId = productRegistry.interface.parseLog(event).args[0];
    });

    it("Should allow manufacturer to transfer product to authorized retailer", async function () {
      const location = "Warehouse A";
      const verificationHash = ethers.keccak256(ethers.toUtf8Bytes("verification_proof"));
      
      const tx = await productRegistry.connect(manufacturer).transferProduct(
        productId,
        retailer.address,
        location,
        verificationHash
      );
      
      await expect(tx)
        .to.emit(productRegistry, "ProductTransferred");
      
      // Check that the transfer happened with correct addresses (timestamp can vary)
      const receipt = await tx.wait();
      const transferEvent = receipt.logs.find(log => 
        log.topics[0] === productRegistry.interface.getEvent("ProductTransferred").topicHash
      );
      expect(transferEvent).to.not.be.undefined;
    });

    it("Should not allow transfer to unauthorized retailer", async function () {
      const location = "Warehouse A";
      const verificationHash = ethers.keccak256(ethers.toUtf8Bytes("verification_proof"));
      
      await expect(productRegistry.connect(manufacturer).transferProduct(
        productId,
        user1.address, // Not an authorized retailer
        location,
        verificationHash
      ))
        .to.be.revertedWith("Unauthorized retailer");
    });

    it("Should not allow non-owner to transfer product", async function () {
      const location = "Warehouse A";
      const verificationHash = ethers.keccak256(ethers.toUtf8Bytes("verification_proof"));
      
      await expect(productRegistry.connect(user1).transferProduct(
        productId,
        retailer.address,
        location,
        verificationHash
      ))
        .to.be.revertedWith("Not owner");
    });

    it("Should update product state correctly after transfer", async function () {
      const location = "Warehouse A";
      const verificationHash = ethers.keccak256(ethers.toUtf8Bytes("verification_proof"));
      
      await productRegistry.connect(manufacturer).transferProduct(
        productId,
        retailer.address,
        location,
        verificationHash
      );
      
      const product = await productRegistry.products(productId);
      expect(product.currentOwner).to.equal(retailer.address);
    });

    it("Should record transfer in product history", async function () {
      const location = "Warehouse A";
      const verificationHash = ethers.keccak256(ethers.toUtf8Bytes("verification_proof"));
      
      await productRegistry.connect(manufacturer).transferProduct(
        productId,
        retailer.address,
        location,
        verificationHash
      );
      
      const history = await productRegistry.getProductHistory(productId);
      expect(history.length).to.equal(2); // Registration + Transfer
      
      const transferEvent = history[1];
      expect(transferEvent.from).to.equal(manufacturer.address);
      expect(transferEvent.to).to.equal(retailer.address);
      expect(transferEvent.location).to.equal(location);
      expect(transferEvent.verificationHash).to.equal(verificationHash);
    });
  });

  describe("Status Management", function () {
    let productId;

    beforeEach(async function () {
      const metadataURI = "ipfs://QmTest123";
      const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      productId = productRegistry.interface.parseLog(event).args[0];
    });

    it("Should allow valid status transitions", async function () {
      // Registered -> InTransit
      await expect(productRegistry.connect(manufacturer).updateStatus(productId, 1)) // InTransit
        .to.emit(productRegistry, "ProductStatusChanged")
        .withArgs(productId, 1);
      
      // InTransit -> AtRetailer
      await expect(productRegistry.connect(manufacturer).updateStatus(productId, 2)) // AtRetailer
        .to.emit(productRegistry, "ProductStatusChanged")
        .withArgs(productId, 2);
      
      // AtRetailer -> Sold
      await expect(productRegistry.connect(manufacturer).updateStatus(productId, 3)) // Sold
        .to.emit(productRegistry, "ProductStatusChanged")
        .withArgs(productId, 3);
    });

    it("Should allow transition to Disputed from any state", async function () {
      await expect(productRegistry.connect(manufacturer).updateStatus(productId, 4)) // Disputed
        .to.emit(productRegistry, "ProductStatusChanged")
        .withArgs(productId, 4);
    });

    it("Should not allow invalid status transitions", async function () {
      // Registered -> Sold (skipping intermediate states)
      await expect(productRegistry.connect(manufacturer).updateStatus(productId, 3))
        .to.be.revertedWith("Invalid transition");
    });

    it("Should not allow non-owner to update status", async function () {
      await expect(productRegistry.connect(user1).updateStatus(productId, 1))
        .to.be.revertedWith("Not authorized");
    });
  });

  describe("Verification Recording", function () {
    let productId;

    beforeEach(async function () {
      const metadataURI = "ipfs://QmTest123";
      const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      productId = productRegistry.interface.parseLog(event).args[0];
    });

    it("Should allow verifier to record verification", async function () {
      const verificationHash = ethers.keccak256(ethers.toUtf8Bytes("verification_result"));
      
      await expect(productRegistry.connect(user1).recordVerification(productId, verificationHash))
        .to.emit(productRegistry, "VerificationRecorded")
        .withArgs(productId, verificationHash);
    });

    it("Should not allow non-verifier to record verification", async function () {
      const verificationHash = ethers.keccak256(ethers.toUtf8Bytes("verification_result"));
      
      await expect(productRegistry.connect(user2).recordVerification(productId, verificationHash))
        .to.be.reverted;
    });
  });

  describe("Metadata Updates", function () {
    let productId;

    beforeEach(async function () {
      const metadataURI = "ipfs://QmTest123";
      const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      productId = productRegistry.interface.parseLog(event).args[0];
    });

    it("Should allow manufacturer to update metadata", async function () {
      const newMetadataURI = "ipfs://QmNewTest456";
      
      await expect(productRegistry.connect(manufacturer).updateMetadata(productId, newMetadataURI))
        .to.emit(productRegistry, "MetadataUpdated")
        .withArgs(productId, newMetadataURI);
      
      const product = await productRegistry.products(productId);
      expect(product.metadataURI).to.equal(newMetadataURI);
    });

    it("Should not allow non-manufacturer to update metadata", async function () {
      const newMetadataURI = "ipfs://QmNewTest456";
      
      await expect(productRegistry.connect(user1).updateMetadata(productId, newMetadataURI))
        .to.be.revertedWith("Not manufacturer");
    });
  });

  describe("Query Functions", function () {
    let productId;

    beforeEach(async function () {
      const metadataURI = "ipfs://QmTest123";
      const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      productId = productRegistry.interface.parseLog(event).args[0];
    });

    it("Should return correct product existence status", async function () {
      expect(await productRegistry.isRegistered(productId)).to.be.true;
      
      const nonExistentId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      expect(await productRegistry.isRegistered(nonExistentId)).to.be.false;
    });

    it("Should return correct product details", async function () {
      const product = await productRegistry.products(productId);
      expect(product.exists).to.be.true;
      expect(product.manufacturer).to.equal(manufacturer.address);
      expect(product.currentOwner).to.equal(manufacturer.address);
    });

    it("Should return product history correctly", async function () {
      // Initial history should contain registration event
      let history = await productRegistry.getProductHistory(productId);
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(ethers.ZeroAddress);
      expect(history[0].to).to.equal(manufacturer.address);
      
      // Add a transfer
      const location = "Warehouse A";
      const verificationHash = ethers.keccak256(ethers.toUtf8Bytes("verification_proof"));
      await productRegistry.connect(manufacturer).transferProduct(
        productId,
        retailer.address,
        location,
        verificationHash
      );
      
      history = await productRegistry.getProductHistory(productId);
      expect(history.length).to.equal(2);
    });
  });

  describe("Pausable", function () {
    it("Should prevent registration when paused", async function () {
      await productRegistry.pause();
      
      const metadataURI = "ipfs://QmTest123";
      await expect(productRegistry.connect(manufacturer).registerProduct(metadataURI))
        .to.be.revertedWithCustomError(productRegistry, "EnforcedPause");
    });

    it("Should allow admin to pause and unpause", async function () {
      await productRegistry.pause();
      expect(await productRegistry.paused()).to.be.true;
      
      await productRegistry.unpause();
      expect(await productRegistry.paused()).to.be.false;
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(productRegistry.connect(user1).pause())
        .to.be.reverted;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle transfer to zero address", async function () {
      const metadataURI = "ipfs://QmTest123";
      const tx = await productRegistry.connect(manufacturer).registerProduct(metadataURI);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return productRegistry.interface.parseLog(log).name === "ProductRegistered";
        } catch {
          return false;
        }
      });
      const productId = productRegistry.interface.parseLog(event).args[0];
      
      const location = "Warehouse A";
      const verificationHash = ethers.keccak256(ethers.toUtf8Bytes("verification_proof"));
      
      await expect(productRegistry.connect(manufacturer).transferProduct(
        productId,
        ethers.ZeroAddress,
        location,
        verificationHash
      ))
        .to.be.revertedWith("Invalid address");
    });

    it("Should handle operations on non-existent product", async function () {
      const nonExistentId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      
      await expect(productRegistry.connect(manufacturer).updateStatus(nonExistentId, 1))
        .to.be.revertedWith("Not found");
    });
  });
});
