import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { useContracts } from "../../hooks/useContracts";
import { useWallet } from "../../contexts/WalletContext";

const BuyAuthWithETH = () => {
  const { authToken } = useContracts();
  const { account } = useWallet();
  const [ethAmount, setEthAmount] = useState("0.1");
  const [authAmount, setAuthAmount] = useState("1000");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState("0");
  const [contractBalance, setContractBalance] = useState("0");

  const AUTH_PER_ETH = 10000; // 1 ETH = 10,000 AUTH

  const loadBalances = useCallback(async () => {
    if (!authToken || !account) return;

    try {
      const userBalance = await authToken.balanceOf(account);
      setBalance(ethers.formatEther(userBalance));

      const contractBal = await authToken.balanceOf(
        await authToken.getAddress()
      );
      setContractBalance(ethers.formatEther(contractBal));
    } catch (error) {
      console.error("Error loading balances:", error);
    }
  }, [authToken, account]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  const handleEthChange = (e) => {
    const eth = e.target.value;
    setEthAmount(eth);
    if (eth && !isNaN(eth)) {
      const auth = parseFloat(eth) * AUTH_PER_ETH;
      setAuthAmount(auth.toFixed(0));
    } else {
      setAuthAmount("0");
    }
  };

  const handleAuthChange = (e) => {
    const auth = e.target.value;
    setAuthAmount(auth);
    if (auth && !isNaN(auth)) {
      const eth = parseFloat(auth) / AUTH_PER_ETH;
      setEthAmount(eth.toFixed(6));
    } else {
      setEthAmount("0");
    }
  };

  const handleBuyAuth = async () => {
    if (!authToken || !account) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!ethAmount || parseFloat(ethAmount) <= 0) {
      toast.error("Please enter a valid ETH amount");
      return;
    }

    setLoading(true);
    try {
      const value = ethers.parseEther(ethAmount);
      const tx = await authToken.buyAuthWithETH({ value });

      toast.info("Transaction submitted. Waiting for confirmation...");
      await tx.wait();

      toast.success(
        `✅ Successfully bought ${authAmount} AUTH for ${ethAmount} ETH!`
      );
      await loadBalances();
      setEthAmount("0.1");
      setAuthAmount("1000");
    } catch (error) {
      console.error("Error buying AUTH:", error);
      if (error.message.includes("Insufficient AUTH in contract")) {
        toast.error(
          "Contract has insufficient AUTH tokens. Please contact admin."
        );
      } else if (error.message.includes("user rejected")) {
        toast.warning("Transaction cancelled");
      } else {
        toast.error("Failed to buy AUTH: " + (error.reason || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [
    { eth: "0.01", auth: "100", label: "100" },
    { eth: "0.1", auth: "1000", label: "1K" },
    { eth: "0.5", auth: "5000", label: "5K" },
    { eth: "1", auth: "10000", label: "10K" },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">💰 Buy AUTH Tokens</h2>
        <div className="text-right">
          <p className="text-xs text-gray-600">Balance</p>
          <p className="text-sm font-semibold text-blue-600">
            {parseFloat(balance).toFixed(0)} AUTH
          </p>
        </div>
      </div>

      <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
        <div className="flex items-center justify-between text-xs">
          <span className="text-blue-800">Rate:</span>
          <span className="font-bold text-blue-900">
            1 ETH = {AUTH_PER_ETH.toLocaleString()} AUTH
          </span>
        </div>
      </div>

      {/* Quick amount buttons */}
      <div className="mb-3">
        <div className="grid grid-cols-4 gap-1">
          {quickAmounts.map((amount, idx) => (
            <button
              key={idx}
              onClick={() => {
                setEthAmount(amount.eth);
                setAuthAmount(amount.auth);
              }}
              className="px-2 py-1 bg-gray-100 hover:bg-blue-100 border border-gray-300 rounded text-xs font-medium transition-colors"
            >
              {amount.label}
            </button>
          ))}
        </div>
      </div>

      {/* ETH and AUTH inputs in one row */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Pay (ETH)
          </label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={ethAmount}
            onChange={handleEthChange}
            placeholder="0.1"
            className="w-full px-2 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Receive (AUTH)
          </label>
          <input
            type="number"
            step="1"
            min="0"
            value={authAmount}
            onChange={handleAuthChange}
            placeholder="1000"
            className="w-full px-2 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Buy button */}
      <button
        onClick={handleBuyAuth}
        disabled={loading || !account || parseFloat(ethAmount) <= 0}
        className={`w-full py-2 rounded font-semibold text-white text-sm transition-colors ${
          loading || !account || parseFloat(ethAmount) <= 0
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {loading
          ? "Processing..."
          : !account
          ? "Connect Wallet"
          : `Buy ${authAmount} AUTH`}
      </button>
    </div>
  );
};

export default BuyAuthWithETH;
