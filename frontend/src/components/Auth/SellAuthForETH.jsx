import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { useContracts } from "../../hooks/useContracts";
import { useWallet } from "../../contexts/WalletContext";

const SellAuthForETH = () => {
  const { authToken } = useContracts();
  const { account } = useWallet();
  const [authAmount, setAuthAmount] = useState("1000");
  const [ethAmount, setEthAmount] = useState("0.1");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState("0");
  const [contractBalance, setContractBalance] = useState("0");

  const AUTH_PER_ETH = 10000; // 1 ETH = 10,000 AUTH

  const loadBalances = useCallback(async () => {
    if (!authToken || !account) return;

    try {
      const userBalance = await authToken.balanceOf(account);
      setBalance(ethers.formatEther(userBalance));

      const contractBal = await authToken.balanceOf(await authToken.getAddress());
      setContractBalance(ethers.formatEther(contractBal));
    } catch (error) {
      console.error("Error loading balances:", error);
    }
  }, [authToken, account]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

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

  const handleSellAuth = async () => {
    if (!authToken || !account) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!authAmount || parseFloat(authAmount) <= 0) {
      toast.error("Please enter a valid AUTH amount");
      return;
    }

    setLoading(true);
    try {
      const authWei = ethers.parseUnits(authAmount, 18);
      const tx = await authToken.sellAuthForETH(authWei);

      toast.info("Transaction submitted. Waiting for confirmation...");
      await tx.wait();

      toast.success(`✅ Successfully sold ${authAmount} AUTH for ${ethAmount} ETH!`);
      await loadBalances();
      setAuthAmount("1000");
      setEthAmount("0.1");
    } catch (error) {
      console.error("Error selling AUTH:", error);
      if (error.message && error.message.includes("Insufficient ETH in contract")) {
        toast.error("Contract has insufficient ETH. Please contact admin.");
      } else if (error.message && error.message.includes("user rejected")) {
        toast.warning("Transaction cancelled");
      } else {
        toast.error("Failed to sell AUTH: " + (error.reason || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [
    { auth: "100", eth: "0.01", label: "100" },
    { auth: "1000", eth: "0.1", label: "1K" },
    { auth: "5000", eth: "0.5", label: "5K" },
    { auth: "10000", eth: "1", label: "10K" },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">💸 Sell AUTH Tokens</h2>
        <div className="text-right">
          <p className="text-xs text-gray-600">Balance</p>
          <p className="text-sm font-semibold text-blue-600">
            {parseFloat(balance).toFixed(0)} AUTH
          </p>
        </div>
      </div>

      <div className="mb-3 p-2 bg-yellow-50 rounded border border-yellow-200">
        <div className="flex items-center justify-between text-xs">
          <span className="text-yellow-800">Rate:</span>
          <span className="font-bold text-yellow-900">
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
                setAuthAmount(amount.auth);
                setEthAmount(amount.eth);
              }}
              className="px-2 py-1 bg-gray-100 hover:bg-yellow-100 border border-gray-300 rounded text-xs font-medium transition-colors"
            >
              {amount.label}
            </button>
          ))}
        </div>
      </div>

      {/* AUTH and ETH inputs in one row */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sell (AUTH)</label>
          <input
            type="number"
            step="1"
            min="0"
            value={authAmount}
            onChange={handleAuthChange}
            placeholder="1000"
            className="w-full px-2 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-yellow-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Receive (ETH)</label>
          <input
            type="number"
            step="0.000001"
            min="0"
            value={ethAmount}
            onChange={handleEthChange}
            placeholder="0.1"
            className="w-full px-2 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-yellow-500 text-sm"
          />
        </div>
      </div>

      {/* Sell button */}
      <button
        onClick={handleSellAuth}
        disabled={loading || !account || parseFloat(authAmount) <= 0}
        className={`w-full py-2 rounded font-semibold text-white text-sm transition-colors ${
          loading || !account || parseFloat(authAmount) <= 0
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-yellow-600 hover:bg-yellow-700"
        }`}
      >
        {loading
          ? "Processing..."
          : !account
          ? "Connect Wallet"
          : `Sell ${authAmount} AUTH`}
      </button>
    </div>
  );
};

export default SellAuthForETH;
