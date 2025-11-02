import React, { useState } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import {
  AiOutlineQrcode,
  AiOutlineSearch,
  AiOutlineCheckCircle,
  AiOutlineWarning,
  AiOutlineEnvironment,
} from "react-icons/ai";
import { MdVerified, MdWarning } from "react-icons/md";
import { FaShieldAlt } from "react-icons/fa";
import { useWallet } from "../contexts/WalletContext";
import Card from "../components/Common/Card";
import Button from "../components/Common/Button";
import LoadingSpinner from "../components/Common/LoadingSpinner";
import EnhancedProductDetailsModal from "../components/Product/EnhancedProductDetailsModal";
import { ButtonVariants } from "../types";
import ProductRegistryABI from "../contracts/ProductRegistry.json";
import RetailerRegistryABI from "../contracts/RetailerRegistry.json";
import { CONTRACT_ADDRESSES } from "../utils/constants";

const PRODUCT_STATUS_LABELS = {
  0: "Registered",
  1: "In Transit",
  2: "At Retailer",
  3: "Sold",
  4: "Disputed",
};

const ConsumerVerificationPage = () => {
  const { provider, isConnected } = useWallet();

  const [productIdInput, setProductIdInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [verificationResult, setVerificationResult] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const formatAddress = (address) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const simulateQRScan = () => {
    setIsScanning(true);
    // Simulate QR code scanning with a delay
    setTimeout(() => {
      // Generate a mock product ID for demo
      const mockId =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");
      setProductIdInput(mockId);
      setIsScanning(false);
      toast.success("QR Code scanned successfully!");
    }, 1500);
  };

  const verifyProduct = async () => {
    if (!provider) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!productIdInput || productIdInput.trim() === "") {
      toast.error("Please enter or scan a product ID");
      return;
    }

    setIsLoading(true);
    setVerificationResult(null);

    try {
      const productRegistryAddress =
        CONTRACT_ADDRESSES.PRODUCT_REGISTRY ||
        process.env.REACT_APP_PRODUCT_REGISTRY_ADDRESS;
      const retailerRegistryAddress =
        CONTRACT_ADDRESSES.RETAILER_REGISTRY ||
        process.env.REACT_APP_RETAILER_REGISTRY_ADDRESS;

      if (!productRegistryAddress || productRegistryAddress === "0x...") {
        throw new Error("ProductRegistry address not configured");
      }

      const productRegistry = new ethers.Contract(
        productRegistryAddress,
        ProductRegistryABI.abi,
        provider
      );

      // Load product details
      const productData = await productRegistry.getProduct(productIdInput);

      if (!productData.exists) {
        throw new Error(
          "Product not found on blockchain. This may be a counterfeit!"
        );
      }

      // Load transfer history
      let transferHistory = [];
      try {
        const history = await productRegistry.getProductHistory(productIdInput);
        transferHistory = history.map((transfer) => ({
          from: transfer.from,
          to: transfer.to,
          timestamp: Number(transfer.timestamp) * 1000,
          location: transfer.location || "Unknown",
          verificationHash: transfer.verificationHash,
        }));
      } catch (err) {
        console.warn("Could not load transfer history:", err);
      }

      // Check if verified
      const isVerified = transferHistory.some(
        (t) => t.location === "Verification Node"
      );
      const verifications = transferHistory
        .filter((t) => t.location === "Verification Node")
        .map((t, idx) => ({
          timestamp: t.timestamp,
          verifier: t.from,
          result: "Authenticity Confirmed",
        }));

      // Load retailer reputation if at retailer
      let retailerReputation = null;
      if (
        Number(productData.status) === 2 &&
        retailerRegistryAddress &&
        retailerRegistryAddress !== "0x..."
      ) {
        try {
          const retailerRegistry = new ethers.Contract(
            retailerRegistryAddress,
            RetailerRegistryABI,
            provider
          );
          const retailerData = await retailerRegistry.retailers(
            productData.currentOwner
          );
          retailerReputation = {
            score: Number(retailerData.reputationScore),
            name: retailerData.name || formatAddress(productData.currentOwner),
            totalProducts: Number(retailerData.totalProductsHandled),
          };
        } catch (err) {
          console.warn("Could not load retailer data:", err);
        }
      }

      // Calculate confidence score
      const confidenceScore = calculateConfidenceScore({
        isVerified,
        transferCount: transferHistory.length,
        age: Date.now() - Number(productData.registeredAt) * 1000,
        status: Number(productData.status),
        retailerReputation,
      });

      const result = {
        product: {
          productId: productIdInput,
          manufacturer: productData.manufacturer,
          currentOwner: productData.currentOwner,
          status: Number(productData.status),
          registeredAt: Number(productData.registeredAt) * 1000,
          metadataURI: productData.metadataURI,
          exists: productData.exists,
        },
        transferHistory,
        verifications,
        isVerified,
        retailerReputation,
        confidenceScore,
        riskLevel:
          confidenceScore >= 80
            ? "low"
            : confidenceScore >= 50
            ? "medium"
            : "high",
      };

      setVerificationResult(result);
      toast.success("Product verification complete!");
    } catch (err) {
      console.error("Verification error:", err);
      toast.error(err.message || "Failed to verify product");

      // Set error result
      setVerificationResult({
        error: true,
        message: err.message || "Product not found on blockchain",
        riskLevel: "critical",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateConfidenceScore = ({
    isVerified,
    transferCount,
    age,
    status,
    retailerReputation,
  }) => {
    let score = 0;

    // Verification adds 40 points
    if (isVerified) score += 40;

    // Transfer history adds up to 20 points
    score += Math.min(transferCount * 5, 20);

    // Age adds up to 15 points (older is more credible)
    const daysSinceRegistration = age / (1000 * 60 * 60 * 24);
    score += Math.min(daysSinceRegistration * 2, 15);

    // Status adds points
    if (status === 2 || status === 3) score += 10; // At retailer or sold
    if (status === 4) score -= 30; // Disputed is bad

    // Retailer reputation adds up to 15 points
    if (retailerReputation) {
      score += Math.min((retailerReputation.score / 1000) * 15, 15);
    }

    return Math.max(0, Math.min(100, score));
  };

  return (
    <div className="pt-20 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Consumer Product Verification
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Verify product authenticity before purchase. Scan the QR code or enter
          the product ID to check if a product is genuine and view its complete
          history.
        </p>
      </div>

      {/* Scan/Input Section */}
      <Card className="mb-8">
        <div className="text-center mb-6">
          <div className="inline-block p-6 bg-blue-50 rounded-full mb-4">
            <AiOutlineQrcode className="text-blue-600 text-6xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Scan or Enter Product ID
          </h2>
          <p className="text-gray-600">
            Use your device camera or manually enter the product identifier
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {/* QR Scan Button */}
          <Button
            variant={ButtonVariants.PRIMARY}
            onClick={simulateQRScan}
            disabled={isScanning || isLoading}
            className="w-full py-4 text-lg"
          >
            <AiOutlineQrcode className="mr-2 text-xl" />
            {isScanning ? "Scanning..." : "Scan QR Code (Simulated)"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">
                or enter manually
              </span>
            </div>
          </div>

          {/* Manual Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product ID (bytes32)
            </label>
            <input
              type="text"
              value={productIdInput}
              onChange={(e) => setProductIdInput(e.target.value)}
              placeholder="0x1234567890abcdef..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          <Button
            variant={ButtonVariants.SECONDARY}
            onClick={verifyProduct}
            disabled={isLoading || !isConnected || !productIdInput.trim()}
            className="w-full py-3"
          >
            <AiOutlineSearch className="mr-2" />
            {isLoading ? "Verifying..." : "Verify Product"}
          </Button>
        </div>
      </Card>

      {/* Connection Warning */}
      {!isConnected && (
        <Card className="mb-8 bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3">
            <AiOutlineWarning className="text-yellow-600 text-2xl flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-900">
                Wallet Not Connected
              </h3>
              <p className="text-sm text-yellow-700">
                Please connect your wallet to verify products
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="large" />
        </div>
      )}

      {/* Verification Results */}
      {verificationResult && !isLoading && (
        <div className="space-y-6">
          {verificationResult.error ? (
            /* Error/Counterfeit Warning */
            <Card className="bg-red-50 border-2 border-red-300">
              <div className="flex items-start gap-4">
                <MdWarning className="text-red-600 text-5xl flex-shrink-0" />
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-red-900 mb-2">
                    ⚠️ WARNING: Product Not Found
                  </h2>
                  <p className="text-red-700 mb-4">
                    {verificationResult.message}
                  </p>
                  <div className="bg-red-100 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-900 mb-2">
                      This may indicate:
                    </h3>
                    <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                      <li>The product is counterfeit</li>
                      <li>The product ID is incorrect</li>
                      <li>
                        The product was never registered on the blockchain
                      </li>
                    </ul>
                  </div>
                  <p className="mt-4 text-sm text-red-700 font-medium">
                    ⚠️ We strongly recommend NOT purchasing this product
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            /* Authentic Product Results */
            <>
              {/* Confidence Score Card */}
              <Card
                className={`border-2 ${
                  verificationResult.riskLevel === "low"
                    ? "bg-green-50 border-green-300"
                    : verificationResult.riskLevel === "medium"
                    ? "bg-yellow-50 border-yellow-300"
                    : "bg-orange-50 border-orange-300"
                }`}
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    {verificationResult.riskLevel === "low" ? (
                      <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center">
                        <AiOutlineCheckCircle className="text-white text-5xl" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-yellow-500 flex items-center justify-center">
                        <FaShieldAlt className="text-white text-4xl" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <h2
                      className={`text-3xl font-bold mb-2 ${
                        verificationResult.riskLevel === "low"
                          ? "text-green-900"
                          : "text-yellow-900"
                      }`}
                    >
                      {verificationResult.isVerified
                        ? "✓ Verified Authentic"
                        : "Product Found"}
                    </h2>

                    <p
                      className={`mb-4 ${
                        verificationResult.riskLevel === "low"
                          ? "text-green-700"
                          : "text-yellow-700"
                      }`}
                    >
                      {verificationResult.isVerified
                        ? "This product has been verified on the blockchain and is authentic."
                        : "This product is registered on the blockchain but has not been verified yet."}
                    </p>

                    {/* Confidence Score */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">Confidence Score</span>
                        <span className="text-2xl font-bold">
                          {Math.round(verificationResult.confidenceScore)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div
                          className={`h-4 rounded-full transition-all ${
                            verificationResult.confidenceScore >= 80
                              ? "bg-green-500"
                              : verificationResult.confidenceScore >= 50
                              ? "bg-yellow-500"
                              : "bg-orange-500"
                          }`}
                          style={{
                            width: `${verificationResult.confidenceScore}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Purchase Recommendation */}
                    <div
                      className={`p-4 rounded-lg border ${
                        verificationResult.riskLevel === "low"
                          ? "bg-green-100 border-green-200"
                          : "bg-yellow-100 border-yellow-200"
                      }`}
                    >
                      <h3 className="font-semibold mb-1">
                        {verificationResult.riskLevel === "low"
                          ? "✓ Safe to Purchase"
                          : "⚠️ Purchase with Caution"}
                      </h3>
                      <p className="text-sm">
                        {verificationResult.riskLevel === "low"
                          ? "This product has high confidence score and multiple verifications."
                          : "Consider requesting additional verification before purchase."}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Product Quick Facts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <div className="text-center">
                    <div
                      className={`inline-block p-3 rounded-full mb-2 ${
                        verificationResult.isVerified
                          ? "bg-green-100"
                          : "bg-gray-100"
                      }`}
                    >
                      <MdVerified
                        className={`text-2xl ${
                          verificationResult.isVerified
                            ? "text-green-600"
                            : "text-gray-400"
                        }`}
                      />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {verificationResult.verifications.length}
                    </div>
                    <div className="text-sm text-gray-600">Verifications</div>
                  </div>
                </Card>

                <Card>
                  <div className="text-center">
                    <div className="inline-block p-3 bg-blue-100 rounded-full mb-2">
                      <AiOutlineEnvironment className="text-blue-600 text-2xl" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {verificationResult.transferHistory.length}
                    </div>
                    <div className="text-sm text-gray-600">Transfer Events</div>
                  </div>
                </Card>

                <Card>
                  <div className="text-center">
                    <div className="inline-block p-3 bg-purple-100 rounded-full mb-2">
                      <FaShieldAlt className="text-purple-600 text-xl" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {PRODUCT_STATUS_LABELS[verificationResult.product.status]}
                    </div>
                    <div className="text-sm text-gray-600">Current Status</div>
                  </div>
                </Card>
              </div>

              {/* Retailer Reputation */}
              {verificationResult.retailerReputation && (
                <Card>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    Current Retailer
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {verificationResult.retailerReputation.name}
                      </div>
                      <div className="text-sm text-gray-600 font-mono">
                        {formatAddress(verificationResult.product.currentOwner)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {verificationResult.retailerReputation.score}/1000
                      </div>
                      <div className="text-sm text-gray-600">
                        Reputation Score
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-gray-600">
                    Total products handled:{" "}
                    {verificationResult.retailerReputation.totalProducts}
                  </div>
                </Card>
              )}

              {/* View Full Details Button */}
              <div className="text-center">
                <Button
                  variant={ButtonVariants.PRIMARY}
                  onClick={() => setShowDetailsModal(true)}
                  className="px-8 py-3"
                >
                  View Complete Product Journey →
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Enhanced Product Details Modal */}
      {showDetailsModal && verificationResult && !verificationResult.error && (
        <EnhancedProductDetailsModal
          product={verificationResult.product}
          transferHistory={verificationResult.transferHistory}
          verifications={verificationResult.verifications}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
};

export default ConsumerVerificationPage;
