import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { AiOutlineSearch, AiOutlineArrowLeft } from "react-icons/ai";
import { useWallet } from "../contexts/WalletContext";
import ProductJourneyTimeline from "../components/ProductJourney/ProductJourneyTimeline";
import LoadingSpinner from "../components/Common/LoadingSpinner";
import Button from "../components/Common/Button";
import Card from "../components/Common/Card";
import { ButtonVariants } from "../types";
import ProductRegistryABI from "../contracts/ProductRegistry.json";
import { CONTRACT_ADDRESSES } from "../utils/constants";

const ProductJourneyPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { provider, isConnected } = useWallet();

  const [productId, setProductId] = useState(searchParams.get("id") || "");
  const [product, setProduct] = useState(null);
  const [transferHistory, setTransferHistory] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id && provider) {
      setProductId(id);
      loadProductJourney(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, provider]);

  const loadProductJourney = async (id) => {
    if (!provider) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!id || id.trim() === "") {
      toast.error("Please enter a valid product ID");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const productRegistryAddress =
        CONTRACT_ADDRESSES.PRODUCT_REGISTRY ||
        process.env.REACT_APP_PRODUCT_REGISTRY_ADDRESS;

      if (!productRegistryAddress || productRegistryAddress === "0x...") {
        throw new Error("ProductRegistry address not configured");
      }

      const productRegistry = new ethers.Contract(
        productRegistryAddress,
        ProductRegistryABI.abi,
        provider
      );

      // Load product details
      console.log("Loading product:", id);
      const productData = await productRegistry.getProduct(id);

      if (!productData.exists) {
        throw new Error("Product not found. Please check the product ID.");
      }

      const formattedProduct = {
        productId: id,
        manufacturer: productData.manufacturer,
        currentOwner: productData.currentOwner,
        status: Number(productData.status),
        registeredAt: Number(productData.registeredAt) * 1000,
        metadataURI: productData.metadataURI,
        exists: productData.exists,
      };

      setProduct(formattedProduct);

      // Load transfer history
      try {
        const history = await productRegistry.getProductHistory(id);
        const formattedHistory = history.map((transfer) => ({
          from: transfer.from,
          to: transfer.to,
          timestamp: Number(transfer.timestamp) * 1000,
          location: transfer.location || "Unknown",
          verificationHash:
            transfer.verificationHash ||
            "0x0000000000000000000000000000000000000000000000000000000000000000",
        }));
        setTransferHistory(formattedHistory);

        // Extract verifications from history (entries with "Verification Node" location)
        const verificationsFromHistory = formattedHistory
          .filter((transfer) => transfer.location === "Verification Node")
          .map((transfer, idx) => ({
            timestamp: transfer.timestamp,
            verifier: transfer.from,
            result: "Authenticity Verified",
            fee: "0.01", // Default fee, would need to fetch from VerificationManager
          }));

        setVerifications(verificationsFromHistory);
      } catch (err) {
        console.warn("Error loading transfer history:", err);
        setTransferHistory([]);
        setVerifications([]);
      }

      toast.success("Product journey loaded successfully!");
    } catch (err) {
      console.error("Error loading product journey:", err);
      setError(err.message || "Failed to load product journey");
      toast.error(err.message || "Failed to load product journey");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (productId.trim()) {
      setSearchParams({ id: productId.trim() });
      loadProductJourney(productId.trim());
    }
  };

  const handleClear = () => {
    setProductId("");
    setProduct(null);
    setTransferHistory([]);
    setVerifications([]);
    setError(null);
    setSearchParams({});
  };

  return (
    <div className="pt-20 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Product Journey Tracker
        </h1>
        <p className="text-gray-600">
          Track authentic products through their complete supply chain journey
        </p>
      </div>

      {/* Search Section */}
      <Card className="mb-8">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product ID (bytes32 hash)
            </label>
            <input
              type="text"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="0x1234567890abcdef..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the product ID from the blockchain (66 character hex string
              starting with 0x)
            </p>
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="submit"
              variant={ButtonVariants.PRIMARY}
              disabled={isLoading || !isConnected || !productId.trim()}
              className="whitespace-nowrap"
            >
              <AiOutlineSearch className="mr-2" />
              {isLoading ? "Loading..." : "Track Journey"}
            </Button>
            {product && (
              <Button
                type="button"
                variant={ButtonVariants.SECONDARY}
                onClick={handleClear}
                disabled={isLoading}
              >
                <AiOutlineArrowLeft className="mr-2" />
                Clear
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Connection Warning */}
      {!isConnected && (
        <Card className="mb-8 bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3">
            <div className="text-yellow-600 text-xl">⚠️</div>
            <div>
              <h3 className="font-semibold text-yellow-900">
                Wallet Not Connected
              </h3>
              <p className="text-sm text-yellow-700">
                Please connect your wallet to track product journeys
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <LoadingSpinner size="large" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <div className="text-red-600 text-xl">❌</div>
            <div>
              <h3 className="font-semibold text-red-900 mb-1">
                Error Loading Product
              </h3>
              <p className="text-sm text-red-700">{error}</p>
              <p className="text-xs text-red-600 mt-2">
                Make sure the product ID is correct and the product exists on
                the blockchain.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Product Journey Timeline */}
      {product && !isLoading && !error && (
        <div className="space-y-6">
          {/* Product Info Card */}
          <Card>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Product Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Product ID:</span>
                <p className="font-mono text-xs text-gray-900 mt-1 break-all">
                  {product.productId}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Manufacturer:</span>
                <p className="font-mono text-xs text-gray-900 mt-1">
                  {product.manufacturer}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Current Owner:</span>
                <p className="font-mono text-xs text-gray-900 mt-1">
                  {product.currentOwner}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Registered:</span>
                <p className="text-gray-900 mt-1">
                  {new Date(product.registeredAt).toLocaleString()}
                </p>
              </div>
              {product.metadataURI && (
                <div className="col-span-2">
                  <span className="text-gray-600">Metadata URI:</span>
                  <p className="text-xs text-blue-600 mt-1 break-all">
                    {product.metadataURI}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Timeline */}
          <ProductJourneyTimeline
            product={product}
            transferHistory={transferHistory}
            verifications={verifications}
          />
        </div>
      )}

      {/* Empty State */}
      {!product && !isLoading && !error && (
        <Card className="text-center py-16">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Product Selected
          </h3>
          <p className="text-gray-600 mb-4">
            Enter a product ID above to view its complete supply chain journey
          </p>
          <p className="text-sm text-gray-500">
            You can find product IDs in the Products page or from QR codes on
            physical products
          </p>
        </Card>
      )}
    </div>
  );
};

export default ProductJourneyPage;
