/**
 * Transfer Product Script
 *
 * Usage:
 *   npx hardhat run scripts/transferProduct.js --network localhost
 *
 * Or with specific parameters:
 *   PRODUCT_ID=0x123... TO_ADDRESS=0xabc... LOCATION="Port of Singapore" npx hardhat run scripts/transferProduct.js --network localhost
 */

const hre = require("hardhat");

async function main() {
  console.log("🚀 Product Transfer Script Starting...\n");

  // Get parameters from environment or use defaults
  const PRODUCT_ID = process.env.PRODUCT_ID || "";
  const TO_ADDRESS = process.env.TO_ADDRESS || "";
  const LOCATION = process.env.LOCATION || "Distribution Center";

  // Get contract addresses from deployment
  const PRODUCT_REGISTRY_ADDRESS = process.env.PRODUCT_REGISTRY_ADDRESS;
  const RETAILER_REGISTRY_ADDRESS = process.env.RETAILER_REGISTRY_ADDRESS;

  if (!PRODUCT_REGISTRY_ADDRESS) {
    console.error("❌ PRODUCT_REGISTRY_ADDRESS not set in environment");
    process.exit(1);
  }

  // Get signers
  const [owner, manufacturer, retailer1, retailer2] =
    await hre.ethers.getSigners();

  console.log("📋 Configuration:");
  console.log("  Product Registry:", PRODUCT_REGISTRY_ADDRESS);
  console.log("  Manufacturer:", manufacturer.address);
  console.log("  Retailer 1:", retailer1.address);
  console.log("  Retailer 2:", retailer2.address);
  console.log("");

  // Get contract instances
  const ProductRegistry = await hre.ethers.getContractAt(
    "ProductRegistry",
    PRODUCT_REGISTRY_ADDRESS
  );

  const RetailerRegistry = RETAILER_REGISTRY_ADDRESS
    ? await hre.ethers.getContractAt(
        "RetailerRegistry",
        RETAILER_REGISTRY_ADDRESS
      )
    : null;

  // Interactive mode: prompt for product ID if not provided
  let productId = PRODUCT_ID;
  let toAddress = TO_ADDRESS;

  if (!productId) {
    console.log("📦 No PRODUCT_ID provided. Available options:");
    console.log("   1. Register a new product");
    console.log("   2. Enter existing product ID");
    console.log("");

    // For demo, let's register a new product
    console.log("Creating new product for demo...");
    const metadataURI = `ipfs://QmTest${Date.now()}`;

    const registerTx = await ProductRegistry.connect(
      manufacturer
    ).registerProduct(metadataURI);
    const receipt = await registerTx.wait();

    // Extract product ID from event
    const event = receipt.logs.find((log) => {
      try {
        const parsed = ProductRegistry.interface.parseLog(log);
        return parsed.name === "ProductRegistered";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = ProductRegistry.interface.parseLog(event);
      productId = parsed.args.productId;
      console.log("✅ Product registered:", productId);
    } else {
      console.error("❌ Failed to get product ID from registration");
      process.exit(1);
    }
  }

  if (!toAddress) {
    toAddress = retailer1.address;
    console.log("📍 No TO_ADDRESS provided. Using retailer1:", toAddress);
  }

  console.log("");
  console.log("🔄 Starting Transfer Process...");
  console.log("━".repeat(50));

  // Step 1: Check if product exists
  console.log("\n1️⃣ Checking product exists...");
  try {
    const product = await ProductRegistry.getProduct(productId);
    if (!product.exists) {
      console.error("❌ Product does not exist");
      process.exit(1);
    }
    console.log("✅ Product found");
    console.log("   Current Owner:", product.currentOwner);
    console.log(
      "   Status:",
      ["Registered", "InTransit", "AtRetailer", "Sold", "Disputed"][
        product.status
      ]
    );
  } catch (error) {
    console.error("❌ Error checking product:", error.message);
    process.exit(1);
  }

  // Step 2: Authorize retailer if needed
  if (RetailerRegistry) {
    console.log("\n2️⃣ Checking retailer authorization...");
    try {
      const isAuthorized = await RetailerRegistry.isAuthorizedRetailer(
        manufacturer.address,
        toAddress
      );

      if (!isAuthorized) {
        console.log("   Retailer not authorized. Authorizing now...");
        const authTx = await RetailerRegistry.connect(
          manufacturer
        ).authorizeRetailer(toAddress);
        await authTx.wait();
        console.log("✅ Retailer authorized");
      } else {
        console.log("✅ Retailer already authorized");
      }
    } catch (error) {
      console.warn("⚠️  RetailerRegistry check failed:", error.message);
      console.log("   Continuing without retailer authorization check...");
    }
  } else {
    console.log("\n2️⃣ Skipping retailer authorization (no RetailerRegistry)");
  }

  // Step 3: Generate verification hash
  console.log("\n3️⃣ Generating verification hash...");
  const verificationData = `${productId}-${Date.now()}-${LOCATION}`;
  const verificationHash = hre.ethers.keccak256(
    hre.ethers.toUtf8Bytes(verificationData)
  );
  console.log("✅ Verification hash:", verificationHash);

  // Step 4: Transfer product
  console.log("\n4️⃣ Transferring product...");
  console.log("   From:", manufacturer.address);
  console.log("   To:", toAddress);
  console.log("   Location:", LOCATION);

  try {
    const transferTx = await ProductRegistry.connect(
      manufacturer
    ).transferProduct(productId, toAddress, LOCATION, verificationHash);

    console.log("   Transaction hash:", transferTx.hash);
    console.log("   Waiting for confirmation...");

    const receipt = await transferTx.wait();
    console.log("✅ Transfer confirmed in block:", receipt.blockNumber);
    console.log("   Gas used:", receipt.gasUsed.toString());
  } catch (error) {
    console.error("❌ Transfer failed:", error.message);

    if (error.message.includes("Not owner")) {
      console.error(
        "   💡 Hint: Make sure you're using the current owner's account"
      );
    } else if (error.message.includes("Unauthorized retailer")) {
      console.error(
        "   💡 Hint: Recipient must be authorized in RetailerRegistry"
      );
    }

    process.exit(1);
  }

  // Step 5: Verify transfer
  console.log("\n5️⃣ Verifying transfer...");
  try {
    const product = await ProductRegistry.getProduct(productId);
    console.log("✅ Transfer verified!");
    console.log("   New Owner:", product.currentOwner);
    console.log(
      "   New Status:",
      ["Registered", "InTransit", "AtRetailer", "Sold", "Disputed"][
        product.status
      ]
    );

    // Get transfer history
    const history = await ProductRegistry.getProductHistory(productId);
    console.log("   Total transfers:", history.length);
  } catch (error) {
    console.error("❌ Verification failed:", error.message);
  }

  console.log("\n" + "━".repeat(50));
  console.log("🎉 Transfer Complete!");
  console.log("");
  console.log("📝 Summary:");
  console.log("   Product ID:", productId);
  console.log("   New Owner:", toAddress);
  console.log("   Location:", LOCATION);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
