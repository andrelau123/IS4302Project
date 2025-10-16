// hooks/useWallet.js
import { useState, useEffect, useCallback } from "react";
import { MetaMaskSDKEventType, useSDK } from "@metamask/sdk-react";
import { ethers } from "ethers";
import { toast } from "react-toastify";

const HARDHAT_NETWORK = {
  chainId: "0x7A69", // 31337 in hex
  chainName: "Hardhat Local",
  rpcUrls: ["http://localhost:8545"],
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
};

const useWallet = () => {
  const { sdk, connected, chainId } = useSDK();
  const [currentAccount, setCurrentAccount] = useState(null);
  const [currentChainId, setCurrentChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [balance, setBalance] = useState("0");
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if on correct network (Hardhat local)
  const isCorrectNetwork = currentChainId === "0x7A69" || currentChainId === "31337";

  // Get wallet balance
  const getBalance = useCallback(async (account, ethProvider) => {
    try {
      if (account && ethProvider) {
        const balance = await ethProvider.getBalance(account);
        const formattedBalance = ethers.formatEther(balance);
        setBalance(parseFloat(formattedBalance).toFixed(4));
      }
    } catch (error) {
      console.error("Error getting balance:", error);
      setBalance("0");
    }
  }, []);

  // Switch to Hardhat network
  const switchToHardhatNetwork = useCallback(async () => {
    try {
      if (!window.ethereum) {
        toast.error("MetaMask not detected");
        return false;
      }

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [HARDHAT_NETWORK],
      });
      
      toast.success("Switched to Hardhat Local network");
      return true;
    } catch (error) {
      console.error("Failed to switch network:", error);
      toast.error("Failed to switch to Hardhat network");
      return false;
    }
  }, []);

  // Connect Wallet
  const connectWallet = useCallback(async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    try {
      if (!sdk) {
        toast.error("Please install MetaMask extension");
        return;
      }

      toast.info("Connecting to MetaMask...");
      const accounts = await sdk.connect();
      
      if (accounts && accounts.length > 0) {
        console.log("Connected Account:", accounts[0]);
        setCurrentAccount(accounts[0]);
        setCurrentChainId(chainId ? chainId.toString() : null);
        localStorage.setItem("isWalletConnected", "true");
        localStorage.setItem("connectedAccount", accounts[0]);

        // Initialize provider and signer
        const ethProvider = new ethers.BrowserProvider(window.ethereum);
        await ethProvider.ready;
        setProvider(ethProvider);
        
        const ethSigner = await ethProvider.getSigner();
        setSigner(ethSigner);
        
        // Get balance
        await getBalance(accounts[0], ethProvider);
        
        toast.success(`Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);

        // Check if on correct network
        const currentChain = chainId ? chainId.toString() : null;
        if (currentChain !== "0x7A69" && currentChain !== "31337") {
          toast.warning("Please switch to Hardhat Local network for full functionality");
        }

        console.log("Wallet connected successfully");
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      toast.error("Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  }, [sdk, chainId, getBalance, isConnecting]);

  // Disconnect Wallet
  const disconnectWallet = useCallback(() => {
    console.log("Disconnecting Wallet");
    setCurrentAccount(null);
    setCurrentChainId(null);
    setProvider(null);
    setSigner(null);
    setBalance("0");
    localStorage.removeItem("isWalletConnected");
    localStorage.removeItem("connectedAccount");
    
    if (sdk && sdk.terminate) {
      sdk.terminate();
    }
    
    toast.info("Wallet disconnected");
  }, [sdk]);

  // Check Wallet Connection on Mount
  useEffect(() => {
    const initialize = async () => {
      const isWalletConnected = localStorage.getItem("isWalletConnected");
      const savedAccount = localStorage.getItem("connectedAccount");
      
      if (isWalletConnected === "true" && savedAccount && sdk && !currentAccount) {
        console.log("Reconnecting wallet from local storage");
        try {
          // Check if MetaMask is still connected
          const accounts = await window.ethereum?.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0 && accounts.includes(savedAccount)) {
            await connectWallet();
          } else {
            // Clear stale connection data
            localStorage.removeItem("isWalletConnected");
            localStorage.removeItem("connectedAccount");
          }
        } catch (error) {
          console.error("Error reconnecting wallet:", error);
          localStorage.removeItem("isWalletConnected");
          localStorage.removeItem("connectedAccount");
        }
      }
    };
    
    if (sdk) {
      initialize();
    }
  }, [sdk, connected, currentAccount, connectWallet]);

  // Listen to Account and Chain Changes
  useEffect(() => {
    if (sdk) {
      const handleAccountsChanged = async (payload) => {
        const accounts = payload;
        if (accounts && accounts.length > 0) {
          console.log("Account Changed:", accounts[0]);
          setCurrentAccount(accounts[0]);
          localStorage.setItem("connectedAccount", accounts[0]);

          // Update provider and signer when account changes
          try {
            const ethProvider = new ethers.BrowserProvider(window.ethereum);
            await ethProvider.ready;
            setProvider(ethProvider);
            
            const ethSigner = await ethProvider.getSigner();
            setSigner(ethSigner);
            
            // Get new balance
            await getBalance(accounts[0], ethProvider);
            
            toast.info(`Switched to account ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
          } catch (error) {
            console.error("Error updating account:", error);
          }
        } else {
          console.log("No accounts available, disconnecting wallet");
          disconnectWallet();
        }
      };

      const handleChainChanged = async (payload) => {
        const newChainId = payload;
        console.log("Chain Changed:", newChainId);
        setCurrentChainId(newChainId);
        
        if (newChainId === "0x7A69" || newChainId === "31337") {
          toast.success("Connected to Hardhat Local network");
        } else {
          toast.warning("Please switch to Hardhat Local network for full functionality");
        }

        // Update balance for new network
        if (currentAccount && provider) {
          await getBalance(currentAccount, provider);
        }
      };

      const handleConnect = () => {
        console.log("MetaMask connected");
      };

      const handleDisconnect = () => {
        console.log("MetaMask disconnected");
        disconnectWallet();
      };

      // Register event listeners
      sdk.on("accountsChanged", handleAccountsChanged);
      sdk.on("chainChanged", handleChainChanged);
      sdk.on("connect", handleConnect);
      sdk.on("disconnect", handleDisconnect);

      return () => {
        // Cleanup event listeners
        sdk.off("accountsChanged", handleAccountsChanged);
        sdk.off("chainChanged", handleChainChanged);
        sdk.off("connect", handleConnect);
        sdk.off("disconnect", handleDisconnect);
      };
    }
  }, [disconnectWallet, sdk, currentAccount, provider, getBalance]);

  // Refresh balance periodically
  useEffect(() => {
    if (currentAccount && provider && isCorrectNetwork) {
      const interval = setInterval(() => {
        getBalance(currentAccount, provider);
      }, 10000); // Update every 10 seconds

      return () => clearInterval(interval);
    }
  }, [currentAccount, provider, isCorrectNetwork, getBalance]);

  return {
    // Connection state
    currentAccount,
    chainId: currentChainId,
    isConnected: !!currentAccount,
    isConnecting,
    isCorrectNetwork,
    
    // Wallet data
    balance,
    provider,
    signer,
    
    // Actions
    connectWallet,
    disconnectWallet,
    switchToHardhatNetwork,
    refreshBalance: () => getBalance(currentAccount, provider),
    
    // Utility
    formatAddress: (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "",
  };
};

export default useWallet;
