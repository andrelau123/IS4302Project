import React, { useEffect, useState, useCallback } from "react";
import useVerificationManager from "../hooks/useVerificationManager";
import { useWallet } from "../contexts/WalletContext";
import AuthTokenABI from "../contracts/AuthToken.json";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import ProductRegistryABI from "../contracts/ProductRegistry.json";
import { CONTRACT_ADDRESSES } from "../utils/constants";
import Card from "../components/Common/Card";
import Button from "../components/Common/Button";
import { ButtonVariants } from "../types";

const VerificationPage = () => {
  const { provider, isConnected, account } = useWallet();
  const vm = useVerificationManager();

  const [productIdInput, setProductIdInput] = useState("");
  const [productValueInput, setProductValueInput] = useState("0");
  const [unverifiedProducts, setUnverifiedProducts] = useState([]);
  const [loadingUnverified, setLoadingUnverified] = useState(false);
  const [authBalance, setAuthBalance] = useState(null);
  const [loadingAuthBalance, setLoadingAuthBalance] = useState(false);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Event subscriptions (VerificationManager & ProductRegistry) are attached below after loader is defined

  // Load pending verification requests
  const loadPendingVerifications = useCallback(async () => {
    if (!provider || !account) {
      return;
    }

    setLoadingPending(true);
    try {
      const vmAddress =
        CONTRACT_ADDRESSES.VERIFICATION_MANAGER ||
        process.env.REACT_APP_VERIFICATION_MANAGER_ADDRESS;
      if (!vmAddress || vmAddress === "0x...") {
        setPendingVerifications([]);
        setLoadingPending(false);
        return;
      }

      const VerificationManagerABI = require("../contracts/VerificationManager.json");
      const vmContract = new ethers.Contract(
        vmAddress,
        VerificationManagerABI.abi,
        provider
      );

      // Get ProductRegistry address
      const prAddress =
        CONTRACT_ADDRESSES.PRODUCT_REGISTRY ||
        process.env.REACT_APP_PRODUCT_REGISTRY_ADDRESS;
      const productRegistry = prAddress
        ? new ethers.Contract(prAddress, ProductRegistryABI.abi, provider)
        : null;

      // Get all VerificationRequested events
      const filter = vmContract.filters.VerificationRequested();
      const events = await vmContract.queryFilter(filter);

      const verifications = await Promise.all(
        events.map(async (ev) => {
          try {
            const requestId = ev.args.requestId;
            const request = await vmContract.requests(requestId);

            // Only include requests from current user
            if (request.requester.toLowerCase() !== account.toLowerCase()) {
              return null;
            }

            // Fetch product name from ProductRegistry
            let productName = "Unknown Product";
            if (productRegistry) {
              try {
                const product = await productRegistry.getProduct(
                  request.productId
                );
                const metadataURI = product.metadataURI || "";

                // Extract name from metadata URI
                if (metadataURI) {
                  const hashIndex = metadataURI.indexOf("#");
                  const cleanUri =
                    hashIndex !== -1
                      ? metadataURI.substring(0, hashIndex)
                      : metadataURI;

                  let name = cleanUri
                    .replace("ipfs://", "")
                    .replace("ipfs:", "");
                  name = name.replace(/^Qm/, "");
                  name = name.replace(/-\d+$/, "");
                  name = name.replace(/[-_]/g, " ");
                  name = name
                    .split(" ")
                    .map((w) =>
                      w
                        ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
                        : ""
                    )
                    .join(" ");
                  productName = name || "Product";
                }
              } catch (e) {
                console.warn("Could not fetch product name:", e);
              }
            }

            return {
              requestId: requestId,
              productId: request.productId,
              productName: productName,
              requester: request.requester,
              assignedVerifier: request.assignedVerifier,
              fee: ethers.formatEther(request.fee),
              createdAt: Number(request.createdAt) * 1000,
              completed: request.completed,
              result: request.result,
              status: request.completed
                ? "Completed"
                : request.assignedVerifier === ethers.ZeroAddress
                ? "Pending Assignment"
                : "Assigned",
            };
          } catch (err) {
            console.error("Error loading request:", err);
            return null;
          }
        })
      );

      const valid = verifications.filter((v) => v !== null);
      setPendingVerifications(valid);
    } catch (err) {
      console.error("Error loading pending verifications:", err);
      toast.error("Failed to load pending verifications");
    } finally {
      setLoadingPending(false);
    }
  }, [provider, account]);

  // Load unverified products from ProductRegistry
  const loadUnverifiedProducts = useCallback(async () => {
    if (!provider) {
      return;
    }

    setLoadingUnverified(true);
    try {
      const productRegistryAddress =
        CONTRACT_ADDRESSES.PRODUCT_REGISTRY ||
        process.env.REACT_APP_PRODUCT_REGISTRY_ADDRESS;
      if (!productRegistryAddress || productRegistryAddress === "0x...") {
        toast.error("ProductRegistry address not configured");
        setUnverifiedProducts([]);
        setLoadingUnverified(false);
        return;
      }

      const productRegistry = new ethers.Contract(
        productRegistryAddress,
        ProductRegistryABI.abi,
        provider
      );
      const filter = productRegistry.filters.ProductRegistered();
      const events = await productRegistry.queryFilter(filter);

      const items = await Promise.all(
        events.map(async (ev) => {
          try {
            const productId = ev.args.productId;
            const product = await productRegistry.getProduct(productId);
            let history = [];
            try {
              history = await productRegistry.getProductHistory(productId);
            } catch (e) {
              // ignore
            }

            const isVerified =
              Array.isArray(history) &&
              history.some((h) => {
                try {
                  return h.location === "Verification Node";
                } catch (e) {
                  return false;
                }
              });

            return {
              productId,
              metadataURI: product.metadataURI,
              manufacturer: product.manufacturer,
              status: Number(product.status),
              registeredAt: Number(product.registeredAt) * 1000,
              isVerified,
            };
          } catch (err) {
            return null;
          }
        })
      );

      const valid = items.filter((i) => i && !i.isVerified);
      setUnverifiedProducts(valid);
      if (valid.length === 0) {
        toast.info("No unverified products found");
      }
    } catch (err) {
      console.error("Error loading unverified products", err);
      toast.error("Failed to load unverified products");
    } finally {
      setLoadingUnverified(false);
    }
  }, [provider]);

  // Load user's AuthToken balance
  const loadAuthBalance = useCallback(async () => {
    try {
      setLoadingAuthBalance(true);
      const authAddr =
        CONTRACT_ADDRESSES.AUTH_TOKEN ||
        process.env.REACT_APP_AUTH_TOKEN_ADDRESS;
      if (!provider || !account || !authAddr || authAddr === "0x...") {
        setAuthBalance(null);
        setLoadingAuthBalance(false);
        return;
      }

      const auth = new ethers.Contract(authAddr, AuthTokenABI, provider);
      const bal = await auth.balanceOf(account);
      const formatted = Number(ethers.formatEther(bal));
      setAuthBalance(formatted);
    } catch (e) {
      console.error("loadAuthBalance error", e);
      setAuthBalance(null);
    } finally {
      setLoadingAuthBalance(false);
    }
  }, [provider, account]);

  useEffect(() => {
    loadUnverifiedProducts();
  }, [loadUnverifiedProducts]);

  useEffect(() => {
    loadAuthBalance();
  }, [loadAuthBalance]);

  useEffect(() => {
    loadPendingVerifications();
  }, [loadPendingVerifications]);

  // Subscribe to ProductRegistry.VerificationRecorded to remove verified products from list
  useEffect(() => {
    let offRegistry = null;
    try {
      const productRegistryAddress =
        CONTRACT_ADDRESSES.PRODUCT_REGISTRY ||
        process.env.REACT_APP_PRODUCT_REGISTRY_ADDRESS;
      if (
        provider &&
        productRegistryAddress &&
        productRegistryAddress !== "0x..."
      ) {
        const productRegistry = new ethers.Contract(
          productRegistryAddress,
          ProductRegistryABI.abi,
          provider
        );
        const recordedHandler = (productId, verificationHash, event) => {
          try {
            const pidStr = String(productId);
            setUnverifiedProducts((s) =>
              s.filter((p) => String(p.productId) !== pidStr)
            );
            toast.info(`Product verified: ${pidStr}`);
            // Refresh verifications list after completion
            setTimeout(() => loadPendingVerifications(), 1000);
          } catch (e) {
            // ignore
          }
        };
        productRegistry.on("VerificationRecorded", recordedHandler);
        offRegistry = () => {
          try {
            productRegistry.off("VerificationRecorded", recordedHandler);
          } catch (e) {}
        };
      }
    } catch (e) {
      // ignore
    }

    return () => {
      try {
        offRegistry && offRegistry();
      } catch (e) {}
    };
  }, [loadUnverifiedProducts, loadPendingVerifications, provider]);

  const handleRequest = async () => {
    if (!isConnected) {
      toast.error("Connect wallet");
      return;
    }
    if (!productIdInput) {
      toast.error("Enter productId (bytes32)");
      return;
    }

    try {
      const pid = productIdInput.startsWith("0x")
        ? productIdInput
        : ethers.hexlify(ethers.toUtf8Bytes(productIdInput));
      const value = ethers.parseEther(productValueInput || "0");
      const res = await vm.requestVerification(pid, value);
      if (res && res.success) {
        toast.success("Verification requested — updating list");
        // refresh list after request
        setTimeout(loadUnverifiedProducts, 1000);
      }
    } catch (err) {
      console.error("handleRequest err", err);
      toast.error("Failed to request verification");
    }
  };

  const quickRequest = (product) => {
    setProductIdInput(product.productId);
    // default small value
    setProductValueInput("0.1");
  };

  const extractProductName = (uri) => {
    if (!uri) return "Product";
    let name = String(uri).replace("ipfs://", "").replace("ipfs:", "");
    name = name.replace(/^Qm/, "");
    name = name.replace(/-\d+$/, "");
    name = name.replace(/[-_]/g, " ");
    name = name
      .split(" ")
      .map((w) =>
        w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""
      )
      .join(" ");
    return name || "Product";
  };

  const formatDate = (ts) => {
    try {
      return new Date(ts).toLocaleDateString();
    } catch (e) {
      return "-";
    }
  };

  return (
    <div className="pt-20 p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Verification Center
        </h1>
        <p className="text-gray-600 text-lg">
          Request product verification and track your verification requests
        </p>
      </div>

      <Card className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Request New Verification
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Product ID (bytes32 or text)
            </label>
            <input
              value={productIdInput}
              onChange={(e) => setProductIdInput(e.target.value)}
              className="input-field w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter product ID..."
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Product Value (AUTH token units)
            </label>
            <input
              value={productValueInput}
              onChange={(e) => setProductValueInput(e.target.value)}
              className="input-field w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.1"
            />
          </div>

          <div className="bg-white p-3 rounded-lg border border-blue-200">
            <div className="text-sm font-medium text-gray-700">
              {loadingAuthBalance ? (
                <span>Loading AUTH balance...</span>
              ) : authBalance == null ? (
                <span>Connect wallet to see AUTH balance</span>
              ) : (
                <span>
                  💰 Your AUTH balance:{" "}
                  <span className="font-bold text-blue-600">
                    {String(authBalance)}
                  </span>
                </span>
              )}
            </div>
          </div>

          <Button
            variant={ButtonVariants.PRIMARY}
            onClick={handleRequest}
            className="w-full py-3 text-lg font-semibold"
          >
            Submit Verification Request
          </Button>
        </div>
      </Card>

      <Card className="mb-6 p-6 bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Unverified Products
        </h2>
        {loadingUnverified ? (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-pulse">Loading products...</div>
          </div>
        ) : (
          <div>
            {unverifiedProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                No unverified products found
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {unverifiedProducts.map((p) => (
                  <div
                    key={String(p.productId)}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all bg-gradient-to-r from-white to-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-lg font-semibold text-gray-800 mb-1">
                          {extractProductName(p.metadataURI || p.productId)}
                        </div>
                        <div className="text-sm text-gray-500 mb-2 break-all">
                          {String(p.metadataURI || "").slice(0, 60)}...
                        </div>
                        <div className="flex gap-4 text-xs text-gray-400">
                          <span>📅 {formatDate(p.registeredAt)}</span>
                          <span>
                            🏭 {String(p.manufacturer).slice(0, 10)}...
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          variant={ButtonVariants.OUTLINE}
                          onClick={() => quickRequest(p)}
                          className="whitespace-nowrap"
                        >
                          Select
                        </Button>
                        <Button
                          variant={ButtonVariants.PRIMARY}
                          onClick={async () => {
                            quickRequest(p);
                            await handleRequest();
                          }}
                          className="whitespace-nowrap"
                        >
                          Request
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6 bg-white shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            My Verification Requests
          </h2>
          <button
            onClick={loadPendingVerifications}
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors font-medium"
          >
            🔄 Refresh
          </button>
        </div>

        {loadingPending ? (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-pulse">
              Loading verification requests...
            </div>
          </div>
        ) : pendingVerifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            No verification requests yet
          </div>
        ) : (
          <div className="space-y-4">
            {pendingVerifications.map((v) => (
              <Card
                key={String(v.requestId)}
                className="p-5 bg-gradient-to-br from-white to-gray-50 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="text-lg font-semibold text-gray-900 mb-2">
                      {v.productName}
                    </div>
                    <div className="text-xs text-gray-500 mb-1">Product ID</div>
                    <div className="font-mono text-xs break-all text-gray-600">
                      {String(v.productId).slice(0, 30)}...
                    </div>
                  </div>
                  <div className="ml-4">
                    {v.status === "Completed" && (
                      <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        ✓ Completed
                      </span>
                    )}
                    {v.status === "Assigned" && (
                      <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                        ⏳ In Progress
                      </span>
                    )}
                    {v.status === "Pending Assignment" && (
                      <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                        ⏸ Awaiting Assignment
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">
                      Requested By
                    </div>
                    <div className="font-mono text-sm text-blue-600 break-all">
                      {String(v.requester).slice(0, 6)}...
                      {String(v.requester).slice(-4)}
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Fee Paid</div>
                    <div className="font-semibold text-lg text-gray-800">
                      {v.fee} AUTH
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">
                      Requested On
                    </div>
                    <div className="text-sm text-gray-800">
                      {formatDate(v.createdAt)}
                    </div>
                  </div>
                </div>

                {v.assignedVerifier &&
                  v.assignedVerifier !== ethers.ZeroAddress && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mb-3">
                      <div className="text-xs text-blue-600 mb-1">
                        Assigned Verifier
                      </div>
                      <div className="font-mono text-sm text-blue-800">
                        {String(v.assignedVerifier).slice(0, 10)}...
                        {String(v.assignedVerifier).slice(-8)}
                      </div>
                    </div>
                  )}

                {v.completed && (
                  <div
                    className={`p-3 rounded-lg border ${
                      v.result
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="text-xs text-gray-600 mb-1">
                      Verification Result
                    </div>
                    <div
                      className={`font-semibold text-lg ${
                        v.result ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {v.result ? "✓ Authenticated" : "✗ Failed Verification"}
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-400 font-mono">
                    Request ID: {String(v.requestId).slice(0, 16)}...
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default VerificationPage;
