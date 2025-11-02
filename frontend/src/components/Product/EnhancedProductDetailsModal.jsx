import React, { useState } from "react";
import {
  AiOutlineClose,
  AiOutlineUser,
  AiOutlineCalendar,
  AiOutlineCheckCircle,
} from "react-icons/ai";
import { MdVerified, MdWarning } from "react-icons/md";
import { FaEthereum } from "react-icons/fa";
import ProductJourneyTimeline from "../ProductJourney/ProductJourneyTimeline";
import IoTSensorDashboard from "../IoTSensor/IoTSensorDashboard";
import TransferButton from "./TransferButton";
import Button from "../Common/Button";
import { ButtonVariants } from "../../types";

const PRODUCT_STATUS_LABELS = {
  0: "Registered",
  1: "In Transit",
  2: "At Retailer",
  3: "Sold",
  4: "Disputed",
};

const STATUS_COLORS = {
  0: "bg-blue-100 text-blue-800",
  1: "bg-yellow-100 text-yellow-800",
  2: "bg-purple-100 text-purple-800",
  3: "bg-green-100 text-green-800",
  4: "bg-red-100 text-red-800",
};

const EnhancedProductDetailsModal = ({
  product,
  transferHistory = [],
  verifications = [],
  sensorData = [],
  nftData = null,
  onClose,
  onTransferComplete,
}) => {
  const [activeTab, setActiveTab] = useState("overview");

  if (!product) return null;

  const formatAddress = (address) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown";
    const date =
      typeof timestamp === "number"
        ? new Date(timestamp > 10000000000 ? timestamp : timestamp * 1000)
        : new Date(timestamp);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isVerified =
    verifications.length > 0 ||
    transferHistory.some((t) => t.location === "Verification Node");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "journey", label: "Journey Timeline" },
    { id: "sensors", label: "IoT Sensors" },
    { id: "verifications", label: "Verifications" },
    { id: "nft", label: "NFT Details", show: !!nftData },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              Product Details
            </h2>
            <p className="text-sm text-gray-600 font-mono">
              {product.productId}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`px-4 py-2 rounded-full font-semibold ${
                STATUS_COLORS[product.status]
              }`}
            >
              {PRODUCT_STATUS_LABELS[product.status]}
            </div>
            {isVerified && (
              <div className="px-4 py-2 rounded-full bg-green-100 text-green-800 font-semibold flex items-center gap-2">
                <MdVerified />
                Verified
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <AiOutlineClose size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-1">
            {tabs
              .filter((tab) => tab.show !== false)
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-600 font-medium mb-1">
                    Transfers
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
                    {transferHistory.length}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="text-sm text-green-600 font-medium mb-1">
                    Verifications
                  </div>
                  <div className="text-2xl font-bold text-green-900">
                    {verifications.length}
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="text-sm text-purple-600 font-medium mb-1">
                    Age (Days)
                  </div>
                  <div className="text-2xl font-bold text-purple-900">
                    {Math.floor(
                      (Date.now() - product.registeredAt) /
                        (1000 * 60 * 60 * 24)
                    )}
                  </div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="text-sm text-orange-600 font-medium mb-1">
                    Sensor Readings
                  </div>
                  <div className="text-2xl font-bold text-orange-900">
                    {sensorData.length}
                  </div>
                </div>
              </div>

              {/* Product Information */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Product Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AiOutlineUser className="text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Manufacturer
                      </span>
                    </div>
                    <p className="font-mono text-sm text-gray-900 ml-6">
                      {formatAddress(product.manufacturer)}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AiOutlineUser className="text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Current Owner
                      </span>
                    </div>
                    <p className="font-mono text-sm text-gray-900 ml-6">
                      {formatAddress(product.currentOwner)}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AiOutlineCalendar className="text-gray-400" />
                      <span className="text-sm text-gray-600">Registered</span>
                    </div>
                    <p className="text-sm text-gray-900 ml-6">
                      {formatDate(product.registeredAt)}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AiOutlineCheckCircle className="text-gray-400" />
                      <span className="text-sm text-gray-600">Status</span>
                    </div>
                    <div className="ml-6">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          STATUS_COLORS[product.status]
                        }`}
                      >
                        {PRODUCT_STATUS_LABELS[product.status]}
                      </span>
                    </div>
                  </div>
                </div>

                {product.metadataURI && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">
                      Metadata URI
                    </div>
                    <p className="text-xs text-blue-600 font-mono break-all">
                      {product.metadataURI}
                    </p>
                  </div>
                )}
              </div>

              {/* Authenticity Badge */}
              {isVerified ? (
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <MdVerified className="text-green-600 text-4xl flex-shrink-0" />
                    <div>
                      <h3 className="text-lg font-bold text-green-900 mb-2">
                        ✓ Authentic Product
                      </h3>
                      <p className="text-green-700 mb-2">
                        This product has been verified by {verifications.length}{" "}
                        verification node(s) and its authenticity is confirmed
                        on the blockchain.
                      </p>
                      <div className="text-sm text-green-600">
                        Last verified:{" "}
                        {formatDate(
                          verifications[verifications.length - 1]?.timestamp ||
                            Date.now()
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <MdWarning className="text-yellow-600 text-4xl flex-shrink-0" />
                    <div>
                      <h3 className="text-lg font-bold text-yellow-900 mb-2">
                        Pending Verification
                      </h3>
                      <p className="text-yellow-700">
                        This product has not yet been verified by a verification
                        node. Verification is recommended before purchase.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Journey Timeline Tab */}
          {activeTab === "journey" && (
            <ProductJourneyTimeline
              product={product}
              transferHistory={transferHistory}
              verifications={verifications}
            />
          )}

          {/* Sensors Tab */}
          {activeTab === "sensors" && (
            <IoTSensorDashboard
              sensorData={sensorData}
              productId={product.productId}
            />
          )}

          {/* Verifications Tab */}
          {activeTab === "verifications" && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900">
                Verification History
              </h3>
              {verifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <MdWarning className="mx-auto text-5xl mb-3 text-gray-400" />
                  <p>No verifications recorded yet</p>
                </div>
              ) : (
                verifications.map((verification, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <MdVerified className="text-green-600 text-xl" />
                        <span className="font-semibold text-gray-900">
                          Verification #{index + 1}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatDate(verification.timestamp)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Verifier:</span>
                        <p className="font-mono text-gray-900">
                          {formatAddress(verification.verifier)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Result:</span>
                        <p className="text-gray-900">
                          {verification.result || "Authenticated"}
                        </p>
                      </div>
                      {verification.fee && (
                        <div>
                          <span className="text-gray-600">Fee:</span>
                          <p className="text-gray-900 flex items-center gap-1">
                            <FaEthereum className="text-gray-500" />
                            {verification.fee} ETH
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* NFT Tab */}
          {activeTab === "nft" && nftData && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900">NFT Details</h3>
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Token ID</span>
                    <p className="font-bold text-lg text-gray-900">
                      {nftData.tokenId}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Contract</span>
                    <p className="font-mono text-sm text-gray-900">
                      {formatAddress(nftData.contract)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Owner</span>
                    <p className="font-mono text-sm text-gray-900">
                      {formatAddress(nftData.owner)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Minted</span>
                    <p className="text-sm text-gray-900">
                      {formatDate(nftData.mintedAt)}
                    </p>
                  </div>
                </div>
                {nftData.marketplaceUrl && (
                  <div className="mt-4 pt-4 border-t border-purple-200">
                    <a
                      href={nftData.marketplaceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View on Marketplace →
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center gap-3">
          {/* Transfer Button on left */}
          <TransferButton
            product={product}
            onTransferComplete={(result) => {
              if (onTransferComplete) {
                onTransferComplete(result);
              }
            }}
          />

          {/* Close Button on right */}
          <Button variant={ButtonVariants.SECONDARY} onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedProductDetailsModal;
