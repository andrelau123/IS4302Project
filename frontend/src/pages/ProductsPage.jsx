import React, { useState, useEffect } from "react";
import {
  AiOutlinePlus,
  AiOutlineSearch,
  AiOutlineFilter,
} from "react-icons/ai";
import Card from "../components/Common/Card";
import Button from "../components/Common/Button";
import Modal from "../components/Common/Modal";
import LoadingSpinner from "../components/Common/LoadingSpinner";
import TransferButton from "../components/Product/TransferButton";
import { useProductRegistry } from "../hooks/useContracts";
import { useWallet } from "../contexts/WalletContext";
import { ButtonVariants, PRODUCT_STATUS_LABELS, ModalSizes } from "../types";
import { ethers } from "ethers";
import ProductRegistryABI from "../contracts/ProductRegistry.json";
import ProductNFTABI from "../contracts/ProductNFT.json";
import { toast } from "react-toastify";

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    category: "",
    origin: "",
    metadataURI: "",
    value: "",
  });

  const { registerProduct, getProduct } = useProductRegistry();
  const { account, isConnected, provider, signer } = useWallet();

  // Helper function to extract readable name from metadataURI
  const extractProductName = (uri) => {
    if (!uri) return "Product";

    // Remove any URI fragment (e.g. #category=...) so it doesn't appear in the name
    let name = uri.split("#")[0];

    // Remove ipfs:// prefix
    name = name.replace("ipfs://", "").replace("ipfs:", "");

    // Remove Qm prefix if exists
    name = name.replace(/^Qm/, "");

    // Remove timestamp suffix (last dash and numbers)
    name = name.replace(/-\d+$/, "");

    // Replace dashes/underscores with spaces
    name = name.replace(/[-_]/g, " ");

    // Capitalize first letter of each word
    name = name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    return name || "Product";
  };

  // Mock data for demonstration - replace with actual contract calls
  const mockProducts = [
    {
      id: "0x123...",
      name: "Premium Coffee Beans",
      description: "Ethiopian single-origin coffee beans",
      category: "Food & Beverage",
      status: 0, // REGISTERED
      manufacturer: "0xabc...",
      registeredAt: Date.now() - 86400000, // 1 day ago
      isVerified: true,
    },
    {
      id: "0x456...",
      name: "Organic Cotton T-Shirt",
      description: "Sustainably sourced organic cotton apparel",
      category: "Clothing",
      status: 2, // AT_RETAILER
      manufacturer: "0xdef...",
      registeredAt: Date.now() - 172800000, // 2 days ago
      isVerified: true,
    },
    {
      id: "0x789...",
      name: "Artisan Leather Wallet",
      description: "Handcrafted genuine leather wallet",
      category: "Accessories",
      status: 1, // IN_TRANSIT
      manufacturer: "0xghi...",
      registeredAt: Date.now() - 259200000, // 3 days ago
      isVerified: false,
    },
  ];

  useEffect(() => {
    if (provider) {
      loadProducts();
    }
  }, [provider]);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, statusFilter]);

  const loadProducts = async () => {
    if (!provider) {
      console.log("[ProductsPage] Provider not ready");
      return;
    }

    setIsLoading(true);
    try {
      console.log("[ProductsPage] Loading products from blockchain...");

      // Create contract instance
      const productRegistryAddress =
        process.env.REACT_APP_PRODUCT_REGISTRY_ADDRESS || "";
      const productRegistry = new ethers.Contract(
        productRegistryAddress,
        ProductRegistryABI.abi,
        provider
      );

      // Query ProductRegistered events
      const filter = productRegistry.filters.ProductRegistered();
      const events = await productRegistry.queryFilter(filter);

      console.log(
        `[ProductsPage] Found ${events.length} product registration events`
      );

      const productsData = await Promise.all(
        events.map(async (event) => {
          const productId = event.args.productId;
          const manufacturer = event.args.manufacturer;
          const metadataURI = event.args.metadataURI;

          try {
            // Get current product details
            const product = await productRegistry.getProduct(productId);

            // Extract readable name from metadataURI
            const productName = extractProductName(metadataURI);

            // Fetch product history and check for a verification record
            let isVerified = false;
            try {
              const history = await productRegistry.getProductHistory(
                productId
              );
              // Look for an entry coming from the VerificationManager (location set to "Verification Node")
              if (Array.isArray(history) && history.length > 0) {
                isVerified = history.some((h) => {
                  try {
                    // `location` is expected to be a string in the TransferEvent struct
                    return h.location && h.location === "Verification Node";
                  } catch (e) {
                    return false;
                  }
                });
              }
            } catch (historyErr) {
              console.warn("Could not fetch product history:", historyErr);
            }

            let category = "General";
            try {
              if (metadataURI) {
                // Try to extract category from URI fragment first
                const fragIndex = metadataURI.indexOf("#category=");
                if (fragIndex !== -1) {
                  const frag = metadataURI.substring(
                    fragIndex + "#category=".length
                  );
                  // Support additional fragment params by splitting on &
                  const extractedCategory = decodeURIComponent(
                    frag.split("&")[0]
                  );
                  if (extractedCategory && extractedCategory.trim() !== "") {
                    category = extractedCategory.trim();
                  }
                  console.log(
                    `Extracted category from fragment for ${productId.slice(
                      0,
                      10
                    )}: "${category}"`
                  );
                } else {
                  // Attempt to fetch metadata JSON if URI looks like http or ipfs
                  if (
                    metadataURI.startsWith("http") ||
                    metadataURI.startsWith("ipfs://") ||
                    metadataURI.startsWith("ipfs:")
                  ) {
                    let fetchUrl = metadataURI;
                    if (
                      metadataURI.startsWith("ipfs://") ||
                      metadataURI.startsWith("ipfs:")
                    ) {
                      // Convert ipfs://<hash> to a public gateway URL
                      fetchUrl = metadataURI
                        .replace(/^ipfs:\/\//, "")
                        .replace(/^ipfs:/, "");
                      fetchUrl = `https://ipfs.io/ipfs/${fetchUrl}`;
                    }

                    try {
                      const resp = await fetch(fetchUrl, { method: "GET" });
                      if (resp && resp.ok) {
                        const json = await resp.json();
                        if (json && json.category) {
                          category = json.category;
                        }
                      }
                    } catch (fetchErr) {
                      // ignore fetch errors and keep default
                      console.debug(
                        "ProductsPage: metadata fetch failed",
                        fetchErr
                      );
                    }
                  }
                }
              }
            } catch (e) {
              console.warn(
                "Could not determine product category for",
                productId,
                e
              );
            }

            return {
              id: productId,
              name: productName,
              description: `Product ID: ${productId.slice(0, 10)}...`,
              category: category,
              status: Number(product.status),
              manufacturer: manufacturer,
              owner: product.currentOwner, // Add current owner
              registeredAt: Number(product.registeredAt) * 1000,
              metadataURI: metadataURI,
              isVerified,
            };
          } catch (err) {
            console.error(`Error fetching product ${productId}:`, err);
            return null;
          }
        })
      );

      // Filter out null values and set products
      const validProducts = productsData.filter((p) => p !== null);
      console.log(`[ProductsPage] Loaded ${validProducts.length} products`);

      // Debug: Log owner info
      validProducts.forEach((p) => {
        console.log(
          `Product ${p.name}: currentOwner=${p.currentOwner}, manufacturer=${p.manufacturer}, isVerified=${p.isVerified}`
        );
      });

      setProducts(validProducts);

      if (validProducts.length === 0) {
        toast.info("No products registered yet. Register your first product!");
      }
    } catch (error) {
      console.error("[ProductsPage] Error loading products:", error);
      toast.error("Failed to load products from blockchain");
    } finally {
      setIsLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          product.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (product) => product.status === parseInt(statusFilter)
      );
    }

    setFilteredProducts(filtered);
  };

  const handleConfirmReceipt = async (product) => {
    if (!isConnected || !signer) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const productRegistryAddress =
        process.env.REACT_APP_PRODUCT_REGISTRY_ADDRESS || "";
      const productRegistry = new ethers.Contract(
        productRegistryAddress,
        ProductRegistryABI.abi,
        signer
      );

      toast.info("Confirming receipt...");
      const tx = await productRegistry.confirmReceipt(product.id);
      await tx.wait();

      toast.success(
        "Receipt confirmed! Product status updated to 'At Retailer'!"
      );
      loadProducts(); // Reload products
    } catch (error) {
      console.error("Error confirming receipt:", error);
      toast.error(error.message || "Failed to confirm receipt");
    }
  };

  const handleMintNFT = async (product) => {
    if (!isConnected || !signer) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const productNFTAddress = process.env.REACT_APP_PRODUCT_NFT_ADDRESS || "";
      const productNFT = new ethers.Contract(
        productNFTAddress,
        ProductNFTABI.abi,
        signer
      );

      // Check if NFT already exists for this product
      const existingNFTId = await productNFT.productIdToNFT(product.id);
      if (existingNFTId > 0) {
        toast.warning("NFT already exists for this product!");
        return;
      }

      toast.info("Minting NFT... This may take a moment");
      const tx = await productNFT.mintProductNFT(product.id, account);
      const receipt = await tx.wait();

      // Get the token ID from the event
      const mintEvent = receipt.logs.find((log) => {
        try {
          const parsed = productNFT.interface.parseLog(log);
          return parsed.name === "ProductNFTMinted";
        } catch {
          return false;
        }
      });

      if (mintEvent) {
        const parsed = productNFT.interface.parseLog(mintEvent);
        const tokenId = parsed.args.tokenId;
        toast.success(`🎉 NFT #${tokenId.toString()} minted successfully!`);
      } else {
        toast.success("NFT minted successfully!");
      }

      loadProducts();
    } catch (error) {
      console.error("Error minting NFT:", error);
      if (error.message.includes("NFT already exists")) {
        toast.error("NFT already exists for this product");
      } else if (error.message.includes("Product not authentic")) {
        toast.error("Product must be verified before minting NFT");
      } else if (error.message.includes("user rejected")) {
        toast.warning("Transaction cancelled");
      } else {
        toast.error(error.message || "Failed to mint NFT");
      }
    }
  };

  const handleRegisterProduct = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!signer) {
      toast.error("Wallet signer not available");
      return;
    }

    if (!newProduct.name) {
      toast.error("Please enter a product name");
      return;
    }

    if (!newProduct.value || parseFloat(newProduct.value) <= 0) {
      toast.error("Please enter a valid product value (greater than 0)");
      return;
    }

    try {
      console.log("[ProductsPage] Registering product...");
      toast.info("Registering product on blockchain...");

      // Create contract instance with signer
      const productRegistryAddress =
        process.env.REACT_APP_PRODUCT_REGISTRY_ADDRESS || "";
      console.log(
        "[ProductsPage] Using ProductRegistry address:",
        productRegistryAddress
      );
      const productRegistry = new ethers.Contract(
        productRegistryAddress,
        ProductRegistryABI.abi,
        signer
      );

      // Create metadata URI from product details. Persist selected category and value in the URI fragment
      let metadataURI =
        newProduct.metadataURI ||
        `ipfs://${newProduct.name.replace(/\s+/g, "-")}-${Date.now()}`;

      // Always add category (default to "General" if not specified)
      const categoryToUse = newProduct.category || "General";
      const valueToUse = newProduct.value || "0";
      const frag = `#category=${encodeURIComponent(
        categoryToUse
      )}&value=${encodeURIComponent(valueToUse)}`;
      if (!metadataURI.includes("#category=")) {
        metadataURI = `${metadataURI}${frag}`;
      }

      console.log(
        "[ProductsPage] Calling registerProduct with URI:",
        metadataURI,
        "Category:",
        categoryToUse
      );

      // Call registerProduct on blockchain
      const tx = await productRegistry.registerProduct(metadataURI);

      toast.info("Transaction submitted! Waiting for confirmation...");
      console.log("[ProductsPage] Transaction hash:", tx.hash);

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log("[ProductsPage] Transaction confirmed!", receipt);

      toast.success(`Product "${newProduct.name}" registered successfully!`);

      // Reload products from blockchain
      await loadProducts();

      // Reset form and close modal
      setShowRegisterModal(false);
      setNewProduct({
        name: "",
        description: "",
        category: "",
        origin: "",
        metadataURI: "",
        value: "",
      });
    } catch (error) {
      console.error("[ProductsPage] Error registering product:", error);

      try {
        const iface = new ethers.Interface(ProductRegistryABI.abi);
        const encoded =
          error.data?.data || error.data || error.error?.data?.data;

        if (encoded) {
          const decoded = iface.parseError(encoded);
          console.log("Decoded error:", decoded);

          toast.error(`Error registering product: ${decoded.name}`);
        } else {
          // Fallback if no encoded error
          toast.error(error.reason || error.message || "Transaction failed.");
        }
      } catch (decodeErr) {
        console.error("Error decoding revert:", decodeErr);
        toast.error(error.reason || error.message || "Transaction reverted.");
      }
    }
  };

  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 0:
        return "bg-blue-100 text-blue-800"; // REGISTERED
      case 1:
        return "bg-yellow-100 text-yellow-800"; // IN_TRANSIT
      case 2:
        return "bg-green-100 text-green-800"; // AT_RETAILER
      case 3:
        return "bg-gray-100 text-gray-800"; // SOLD
      case 4:
        return "bg-red-100 text-red-800"; // DISPUTED
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="pt-20 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Product Registry
        </h1>
        <p className="text-gray-600">
          Manage and track your registered products
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <AiOutlineSearch
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10"
            size={20}
          />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-3 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
            style={{ paddingLeft: "3rem" }}
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <AiOutlineFilter className="text-gray-400" size={20} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-48"
          >
            <option value="all">All Status</option>
            <option value="0">Registered</option>
            <option value="1">In Transit</option>
            <option value="2">At Retailer</option>
            <option value="3">Sold</option>
            <option value="4">Disputed</option>
          </select>
        </div>

        {/* Register Button */}
        <Button
          variant={ButtonVariants.PRIMARY}
          onClick={() => setShowRegisterModal(true)}
          className="flex items-center gap-2"
        >
          <AiOutlinePlus size={20} />
          Register Product
        </Button>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner message="Loading products..." />
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No products found
          </h3>
          <p className="text-gray-600 mb-4">
            {products.length === 0
              ? "You haven't registered any products yet."
              : "No products match your current filters."}
          </p>
          {products.length === 0 && (
            <Button
              variant={ButtonVariants.PRIMARY}
              onClick={() => setShowRegisterModal(true)}
            >
              Register Your First Product
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} hover className="relative">
              {/* Verification Badge */}
              {product.isVerified && (
                <div className="absolute top-4 right-4 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                  Verified
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {product.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">
                    {product.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Category:</span>
                    <span className="font-medium">{product.category}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Status:</span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                        product.status
                      )}`}
                    >
                      {PRODUCT_STATUS_LABELS[product.status]}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Manufacturer:</span>
                    <span className="font-medium">
                      {formatAddress(product.manufacturer)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Registered:</span>
                    <span className="font-medium">
                      {formatDate(product.registeredAt)}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 space-y-2">
                  {/* Transfer Button - only show if user owns the product */}
                  <TransferButton
                    product={product}
                    onTransferComplete={() => {
                      toast.success("Product transferred successfully!");
                      loadProducts(); // Reload products after transfer
                    }}
                  />

                  {/* Confirm Receipt Button - only show if product is InTransit and user owns it */}
                  {product.status === 1 &&
                    account &&
                    product.owner &&
                    account.toLowerCase() === product.owner.toLowerCase() && (
                      <Button
                        variant={ButtonVariants.SUCCESS}
                        onClick={() => handleConfirmReceipt(product)}
                        className="w-full bg-green-500 hover:bg-green-600"
                      >
                        📦 Confirm Receipt
                      </Button>
                    )}

                  {/* Mint NFT Button - only show if product is verified and user is the current owner */}
                  {account && product.currentOwner && (
                    <>
                      {/* Debug: Show why button isn't showing */}
                      {!product.isVerified && (
                        <div className="text-xs text-gray-500 p-2 bg-gray-100 rounded">
                          ⚠️ Product not verified yet
                        </div>
                      )}
                      {product.isVerified &&
                        account.toLowerCase() !==
                          product.currentOwner.toLowerCase() && (
                          <div className="text-xs text-gray-500 p-2 bg-gray-100 rounded">
                            ℹ️ Only owner (
                            {product.currentOwner.substring(0, 6)}...) can mint
                          </div>
                        )}
                      {product.isVerified &&
                        account.toLowerCase() ===
                          product.currentOwner.toLowerCase() && (
                          <Button
                            variant={ButtonVariants.PRIMARY}
                            onClick={() => handleMintNFT(product)}
                            className="w-full bg-purple-600 hover:bg-purple-700"
                          >
                            🎨 Mint NFT
                          </Button>
                        )}
                    </>
                  )}

                  <Button
                    variant={ButtonVariants.SECONDARY}
                    onClick={() => handleViewDetails(product)}
                    className="w-full"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Register Product Modal */}
      <Modal
        open={showRegisterModal}
        title="Register New Product"
        onClose={() => setShowRegisterModal(false)}
        maxWidth={ModalSizes.MEDIUM}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Name *
            </label>
            <input
              type="text"
              value={newProduct.name}
              onChange={(e) =>
                setNewProduct((prev) => ({ ...prev, name: e.target.value }))
              }
              className="input-field"
              placeholder="Enter product name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={newProduct.description}
              onChange={(e) =>
                setNewProduct((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={3}
              className="input-field"
              placeholder="Describe your product"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={newProduct.category}
                onChange={(e) =>
                  setNewProduct((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
                className="input-field"
                required
              >
                <option value="">Select category</option>
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Clothing">Clothing</option>
                <option value="Electronics">Electronics</option>
                <option value="Accessories">Accessories</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Value (AUTH) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newProduct.value}
                onChange={(e) =>
                  setNewProduct((prev) => ({ ...prev, value: e.target.value }))
                }
                className="input-field"
                placeholder="e.g., 100"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Origin
            </label>
            <input
              type="text"
              value={newProduct.origin}
              onChange={(e) =>
                setNewProduct((prev) => ({ ...prev, origin: e.target.value }))
              }
              className="input-field"
              placeholder="Country/region of origin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Metadata URI
            </label>
            <input
              type="text"
              value={newProduct.metadataURI}
              onChange={(e) =>
                setNewProduct((prev) => ({
                  ...prev,
                  metadataURI: e.target.value,
                }))
              }
              className="input-field"
              placeholder="IPFS hash or URL (optional)"
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave empty to auto-generate metadata
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant={ButtonVariants.SECONDARY}
              onClick={() => setShowRegisterModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariants.PRIMARY}
              onClick={handleRegisterProduct}
              disabled={
                !newProduct.name ||
                !newProduct.description ||
                !newProduct.category
              }
            >
              Register Product
            </Button>
          </div>
        </div>
      </Modal>

      {/* Product Details Modal */}
      <Modal
        open={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Product Details"
        maxWidth={ModalSizes.EXTRA_LARGE}
      >
        {selectedProduct && (
          <div className="space-y-6">
            {/* Product Header */}
            <div className="border-b border-gray-200 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {selectedProduct.name}
                  </h3>
                  <p className="text-gray-600">{selectedProduct.description}</p>
                </div>
                {selectedProduct.isVerified && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                    Verified
                  </span>
                )}
              </div>
            </div>

            {/* Product Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Product ID
                  </label>
                  <p className="mt-1 text-sm font-mono text-gray-900 break-all">
                    {selectedProduct.id}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Category
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedProduct.category}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Status
                  </label>
                  <p className="mt-1">
                    <span
                      className={`px-3 py-1 text-sm font-medium rounded-full ${
                        selectedProduct.status === 0
                          ? "bg-blue-100 text-blue-800"
                          : selectedProduct.status === 1
                          ? "bg-yellow-100 text-yellow-800"
                          : selectedProduct.status === 2
                          ? "bg-green-100 text-green-800"
                          : selectedProduct.status === 3
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {PRODUCT_STATUS_LABELS[selectedProduct.status] ||
                        "Unknown"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Manufacturer
                  </label>
                  <p className="mt-1 text-sm font-mono text-gray-900">
                    {formatAddress(selectedProduct.manufacturer)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Registered Date
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(selectedProduct.registeredAt).toLocaleString()}
                  </p>
                </div>

                {selectedProduct.metadataURI && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Metadata URI
                    </label>
                    <p className="mt-1 text-sm font-mono text-gray-900 break-all">
                      {selectedProduct.metadataURI}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Blockchain Information */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                Blockchain Information
              </h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Network:</span>
                  <span className="font-medium text-gray-900">
                    Hardhat Local (Chain ID: 31337)
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Contract:</span>
                  <span className="font-mono text-gray-900 text-xs">
                    {formatAddress(
                      process.env.REACT_APP_PRODUCT_REGISTRY_ADDRESS || ""
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Verification Status:</span>
                  <span
                    className={`font-medium ${
                      selectedProduct.isVerified
                        ? "text-green-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {selectedProduct.isVerified
                      ? "Verified on blockchain"
                      : "Pending verification"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant={ButtonVariants.SECONDARY}
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProductsPage;
