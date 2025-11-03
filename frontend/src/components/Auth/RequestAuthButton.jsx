import React, { useState } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { useWallet } from "../../contexts/WalletContext";
import Button from "../Common/Button";
import { ButtonVariants } from "../../types";
import AuthTokenABI from "../../contracts/AuthToken.json";
import { CONTRACT_ADDRESSES } from "../../utils/constants";

const RequestAuthButton = () => {
  const { account, isConnected, signer } = useWallet();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestAuth = async () => {
    if (!isConnected || !signer || !account) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsRequesting(true);

    try {
      const authAddress =
        CONTRACT_ADDRESSES.AUTH_TOKEN ||
        process.env.REACT_APP_AUTH_TOKEN_ADDRESS;

      if (!authAddress || authAddress === "0x...") {
        toast.error("AUTH token address not configured");
        return;
      }

      const authContract = new ethers.Contract(
        authAddress,
        AuthTokenABI.abi,
        signer
      );

      // For demo: Admin (account 0) transfers 100 AUTH to the requesting user
      // In production, this would call a faucet function or backend API
      // Check if user already has enough AUTH
      const balance = await authContract.balanceOf(account);

      toast.info(`Current balance: ${ethers.formatEther(balance)} AUTH`);

      if (balance >= ethers.parseEther("50")) {
        toast.success("You have sufficient AUTH tokens!");
        return;
      }

      // Show instructions for getting AUTH tokens
      toast.info("To get AUTH tokens, run this command in your terminal:", {
        autoClose: false,
      });

      toast.success(
        `npx hardhat run scripts/requestAuth.js --network localhost ${account}`,
        { autoClose: false }
      );

      toast.info("Or copy your address:", { autoClose: 5000 });

      // Copy address to clipboard
      navigator.clipboard.writeText(account);
      toast.success("Address copied to clipboard!", { autoClose: 3000 });
    } catch (error) {
      console.error("Error requesting AUTH:", error);
      toast.error(error.message || "Failed to request AUTH tokens");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <Button
      variant={ButtonVariants.SUCCESS}
      onClick={handleRequestAuth}
      disabled={isRequesting || !isConnected}
      className="flex items-center space-x-2"
    >
      <span>{isRequesting ? "⏳ Requesting..." : "💰 Request 100 AUTH"}</span>
    </Button>
  );
};

export default RequestAuthButton;
