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
  const [requests, setRequests] = useState([]);
  const [unverifiedProducts, setUnverifiedProducts] = useState([]);
  const [loadingUnverified, setLoadingUnverified] = useState(false);
  const [authBalance, setAuthBalance] = useState(null);
  const [loadingAuthBalance, setLoadingAuthBalance] = useState(false);

  // Event subscriptions (VerificationManager & ProductRegistry) are attached below after loader is defined

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

  // Subscribe to VerificationManager and ProductRegistry events (after loader is defined)
  useEffect(() => {
    if (!vm || !vm.listenToEvents) return;

    const off = vm.listenToEvents(
      (req) => {
        toast.info(`Verification requested: ${String(req.requestId)}`);
        setRequests((s) => [
          {
            requestId: req.requestId,
            productId: req.productId,
            requester: req.requester,
            fee: req.fee,
            createdAt: Date.now(),
          },
          ...s,
        ]);
      },
      (a) => {
        toast.info(`Verifier assigned: ${String(a.requestId)}`);
        setRequests((s) =>
          s.map((r) =>
            r.requestId === a.requestId
              ? { ...r, assignedVerifier: a.verifier }
              : r
          )
        );
      },
      (c) => {
        toast.info(
          `Verification completed: ${String(c.requestId)} result:${String(
            c.result
          )}`
        );
        setRequests((s) =>
          s.map((r) =>
            r.requestId === c.requestId
              ? { ...r, completed: true, result: c.result }
              : r
          )
        );
        // Refresh unverified list after completion
        setTimeout(() => loadUnverifiedProducts(), 1000);
      }
    );

    // Subscribe to ProductRegistry.VerificationRecorded to remove verified products from list
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
        off && off();
      } catch (e) {}
      try {
        offRegistry && offRegistry();
      } catch (e) {}
    };
  }, [vm, loadUnverifiedProducts, provider]);

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
    <div className="pt-20 p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Verification Center</h1>
      <p className="text-gray-600 mb-6">
        Request product verification or manage pending requests.
      </p>

      <div className="mb-6 p-4 border rounded-lg">
        <label className="block mb-2">Product ID (bytes32 or text)</label>
        <input
          value={productIdInput}
          onChange={(e) => setProductIdInput(e.target.value)}
          className="input-field w-full mb-2"
        />

        <label className="block mb-2">Product Value (AUTH token units)</label>
        <input
          value={productValueInput}
          onChange={(e) => setProductValueInput(e.target.value)}
          className="input-field w-full mb-2"
        />

        <div className="text-sm text-gray-500 mb-2">
          {loadingAuthBalance ? (
            <span>Loading AUTH balance...</span>
          ) : authBalance == null ? (
            <span>Connect wallet to see AUTH balance</span>
          ) : (
            <span>Your AUTH balance: {String(authBalance)}</span>
          )}
        </div>

        <div className="flex gap-2">
          <button className="btn-primary" onClick={handleRequest}>
            Request Verification
          </button>
        </div>
      </div>

      <div className="p-4 border rounded-lg mb-6">
        <h2 className="font-semibold mb-2">Unverified Products</h2>
        {loadingUnverified ? (
          <div>Loading...</div>
        ) : (
          <div>
            {unverifiedProducts.length === 0 && (
              <div className="text-gray-500">No unverified products</div>
            )}
            <div className="grid grid-cols-1 gap-4">
              {unverifiedProducts.map((p) => (
                <Card key={String(p.productId)} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-lg font-semibold">
                        {extractProductName(p.metadataURI || p.productId)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {String(p.metadataURI || "").slice(0, 80)}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Registered: {formatDate(p.registeredAt)} • Manufacturer:{" "}
                        {String(p.manufacturer).slice(0, 10)}...
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant={ButtonVariants.OUTLINE}
                        onClick={() => quickRequest(p)}
                      >
                        Select
                      </Button>
                      <Button
                        variant={ButtonVariants.PRIMARY}
                        onClick={async () => {
                          quickRequest(p);
                          await handleRequest();
                        }}
                      >
                        Request
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border rounded-lg">
        <h2 className="font-semibold mb-2">Recent Requests (live events)</h2>
        <p className="text-sm text-gray-500">
          Events will appear here when emitted by the contract.
        </p>
        <ul>
          {requests.length === 0 && (
            <li className="text-gray-500">No live requests yet</li>
          )}
          {requests.map((r) => (
            <li key={String(r.requestId)} className="py-1">
              {String(r.requestId)} - {String(r.productId)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default VerificationPage;
