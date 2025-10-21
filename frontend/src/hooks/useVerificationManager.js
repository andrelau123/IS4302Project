import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import VerificationManagerABI from "../contracts/VerificationManager.json";
import AuthTokenABI from "../contracts/AuthToken.json";
import { CONTRACT_ADDRESSES } from "../utils/constants";
import { useWallet } from "../contexts/WalletContext";

export default function useVerificationManager() {
  const { provider, signer, isConnected } = useWallet();
  const [contract, setContract] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (
      provider &&
      CONTRACT_ADDRESSES.VERIFICATION_MANAGER &&
      CONTRACT_ADDRESSES.VERIFICATION_MANAGER !== "0x..."
    ) {
      const cm = new ethers.Contract(
        CONTRACT_ADDRESSES.VERIFICATION_MANAGER,
        VerificationManagerABI.abi,
        provider
      );
      setContract(cm);
    }
  }, [provider]);

  const requestVerification = useCallback(
    async (productId, productValue) => {
      if (!contract || !isConnected || !signer) {
        toast.error("Connect your wallet first");
        return null;
      }
      setIsLoading(true);
      try {
        const c = contract.connect(signer);

        // Determine required fee from contract (if available)
        let fee = productValue;
        try {
          if (contract.calculateVerificationFee) {
            fee = await contract.calculateVerificationFee(productValue);
          }
        } catch (e) {
          // fallback to passed productValue
        }

        // Ensure allowance on AuthToken for the VerificationManager contract
        try {
          const authTokenAddress =
            CONTRACT_ADDRESSES.AUTH_TOKEN ||
            process.env.REACT_APP_AUTH_TOKEN_ADDRESS;
          if (authTokenAddress && authTokenAddress !== "0x...") {
            const auth = new ethers.Contract(
              authTokenAddress,
              AuthTokenABI,
              signer
            );
            const account = await signer.getAddress();
            const vmAddress =
              CONTRACT_ADDRESSES.VERIFICATION_MANAGER ||
              process.env.REACT_APP_VERIFICATION_MANAGER_ADDRESS;
            if (vmAddress && vmAddress !== "0x...") {
              const currentAllowance = await auth.allowance(account, vmAddress);
              if (currentAllowance < fee) {
                // request approval
                const approveTx = await auth.approve(vmAddress, fee);
                toast.info("Approving AuthToken spend for verification fee...");
                await approveTx.wait();
                toast.success("Approved token allowance");
              }
            }
          }
        } catch (e) {
          // don't block the flow if allowance check fails; the tx may still revert
          console.warn("AuthToken allowance check failed", e);
        }

        const tx = await c.requestVerification(productId, productValue);
        toast.info(
          "Verification request submitted. Waiting for confirmation..."
        );
        const receipt = await tx.wait();
        toast.success("Verification requested");
        return { success: true, txHash: receipt.transactionHash };
      } catch (err) {
        console.error("requestVerification error", err);
        toast.error("Failed to request verification");
        return { success: false, error: err };
      } finally {
        setIsLoading(false);
      }
    },
    [contract, signer, isConnected]
  );

  const assignVerifier = useCallback(
    async (requestId, verifierAddress) => {
      if (!contract || !signer) {
        toast.error("Connect your wallet first");
        return null;
      }
      try {
        const c = contract.connect(signer);
        const tx = await c.assignVerifier(requestId, verifierAddress);
        await tx.wait();
        toast.success("Verifier assigned");
        return { success: true };
      } catch (err) {
        console.error("assignVerifier error", err);
        toast.error("Failed to assign verifier");
        return { success: false, error: err };
      }
    },
    [contract, signer]
  );

  const completeVerification = useCallback(
    async (requestId, result, evidenceURI) => {
      if (!contract || !signer) {
        toast.error("Connect your wallet first");
        return null;
      }
      try {
        const c = contract.connect(signer);
        const tx = await c.completeVerification(requestId, result, evidenceURI);
        await tx.wait();
        toast.success("Verification completed");
        return { success: true };
      } catch (err) {
        console.error("completeVerification error", err);
        toast.error("Failed to complete verification");
        return { success: false, error: err };
      }
    },
    [contract, signer]
  );

  const getRequest = useCallback(
    async (requestId) => {
      if (!contract) return null;
      try {
        const r = await contract.requests(requestId);
        return r;
      } catch (err) {
        console.error("getRequest error", err);
        return null;
      }
    },
    [contract]
  );

  const listenToEvents = useCallback(
    (onRequested, onAssigned, onCompleted) => {
      if (!contract || !provider) return () => {};

      const requested = (requestId, productId, requester, fee, event) => {
        if (onRequested) onRequested({ requestId, productId, requester, fee });
      };

      const assigned = (requestId, verifier, event) => {
        if (onAssigned) onAssigned({ requestId, verifier });
      };

      const completed = (requestId, result, verifier, event) => {
        if (onCompleted) onCompleted({ requestId, result, verifier });
      };

      contract.on("VerificationRequested", requested);
      contract.on("VerificationAssigned", assigned);
      contract.on("VerificationCompleted", completed);

      return () => {
        try {
          contract.off("VerificationRequested", requested);
        } catch (e) {}
        try {
          contract.off("VerificationAssigned", assigned);
        } catch (e) {}
        try {
          contract.off("VerificationCompleted", completed);
        } catch (e) {}
      };
    },
    [contract, provider]
  );

  return {
    contract,
    isLoading,
    requestVerification,
    assignVerifier,
    completeVerification,
    getRequest,
    listenToEvents,
  };
}
