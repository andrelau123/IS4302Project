import React, { useState } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { FaExchangeAlt, FaSpinner } from "react-icons/fa";
import { useWallet } from "../../contexts/WalletContext";
import { CONTRACT_ADDRESSES } from "../../utils/constants";
import ProductRegistryABI from "../../contracts/ProductRegistry.json";

/**
 * Simple Transfer Button Component
 *
 * Quick inline transfer without the full modal complexity.
 * Good for adding to product cards or detail views.
 */
const TransferButton = ({ product, onTransferComplete, className = "" }) => {
  const { signer, currentAccount } = useWallet();
  const currentAddress = currentAccount; // For backward compatibility
  const [isTransferring, setIsTransferring] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [location, setLocation] = useState("");

  // Debug: Log configuration on mount
  React.useEffect(() => {
    console.log("TransferButton Configuration:", {
      hasProduct: !!product,
      productId: product?.productId || product?.id,
      productIdProp: product?.productId,
      idProp: product?.id,
      hasSigner: !!signer,
      currentAddress,
      contractAddress: CONTRACT_ADDRESSES.PRODUCT_REGISTRY,
      hasABI: !!(ProductRegistryABI.abi || ProductRegistryABI),
      canTransfer:
        product?.currentOwner === currentAddress ||
        product?.manufacturer === currentAddress,
    });
  }, [product, signer, currentAddress]);

  const handleTransfer = async (e) => {
    e.preventDefault();

    if (!signer || !currentAddress) {
      toast.error("Please connect your wallet first");
      return;
    }

    // Request account access if not already granted
    try {
      if (window.ethereum) {
        await window.ethereum.request({ method: "eth_requestAccounts" });
      }
    } catch (err) {
      toast.error("Please approve the connection in MetaMask");
      return;
    }

    if (
      !CONTRACT_ADDRESSES.PRODUCT_REGISTRY ||
      CONTRACT_ADDRESSES.PRODUCT_REGISTRY === "0x..."
    ) {
      toast.error("Product Registry contract address not configured");
      return;
    }

    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
      toast.error("Invalid recipient address");
      return;
    }

    if (!location.trim()) {
      toast.error("Please enter a location");
      return;
    }

    // Handle both productId and id properties
    const productId = product.productId || product.id;
    if (!productId) {
      toast.error("Invalid product ID");
      return;
    }

    setIsTransferring(true);

    try {
      // Get ABI - handle both .abi property and direct array
      const abi = ProductRegistryABI.abi || ProductRegistryABI;

      if (!abi || abi.length === 0) {
        throw new Error("Product Registry ABI not found");
      }

      const productRegistry = new ethers.Contract(
        CONTRACT_ADDRESSES.PRODUCT_REGISTRY,
        abi,
        signer
      );

      // Verify contract has the transferProduct function
      if (typeof productRegistry.transferProduct !== "function") {
        throw new Error("transferProduct function not found in contract");
      }

      // Generate verification hash
      const verificationHash = ethers.keccak256(
        ethers.toUtf8Bytes(`${productId}-${Date.now()}`)
      );

      toast.info("Submitting transfer transaction...");

      const tx = await productRegistry.transferProduct(
        productId,
        recipientAddress,
        location.trim(),
        verificationHash
      );

      if (!tx || !tx.hash) {
        throw new Error("Transaction failed - no transaction hash returned");
      }

      toast.info("Waiting for confirmation...");
      const receipt = await tx.wait();

      if (!receipt || receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      toast.success("✅ Product transferred successfully!");

      setShowForm(false);
      setRecipientAddress("");
      setLocation("");

      if (onTransferComplete) {
        onTransferComplete({
          productId: productId,
          to: recipientAddress,
          location: location.trim(),
          transactionHash: tx.hash,
        });
      }
    } catch (error) {
      console.error("Transfer error:", error);

      let errorMessage = "Transfer failed";
      if (error.reason) {
        errorMessage = error.reason;
      } else if (error.message?.includes("user rejected")) {
        errorMessage = "Transaction rejected by user";
      }

      toast.error(errorMessage);
    } finally {
      setIsTransferring(false);
    }
  };

  const canTransfer =
    product.currentOwner &&
    currentAddress &&
    product.currentOwner.toLowerCase() === currentAddress.toLowerCase() &&
    product.status !== 3 &&
    product.status !== 4;

  if (!canTransfer) {
    console.log("TransferButton hidden because:", {
      hasCurrentOwner: !!product.currentOwner,
      hasCurrentAddress: !!currentAddress,
      ownersMatch:
        product.currentOwner?.toLowerCase() === currentAddress?.toLowerCase(),
      status: product.status,
      statusOk: product.status !== 3 && product.status !== 4,
    });
    return null;
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${className}`}
      >
        <FaExchangeAlt />
        Transfer Product
      </button>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Transfer Product</h3>
        <button
          onClick={() => setShowForm(false)}
          disabled={isTransferring}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleTransfer} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recipient Address *
          </label>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x..."
            disabled={isTransferring}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm font-mono"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location *
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., Port of Singapore"
            disabled={isTransferring}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm"
            required
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowForm(false)}
            disabled={isTransferring}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isTransferring}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {isTransferring ? (
              <>
                <FaSpinner className="animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <FaExchangeAlt />
                Transfer
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TransferButton;
