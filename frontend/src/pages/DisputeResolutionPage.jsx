import React, { useState } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { AiOutlineFlag } from "react-icons/ai";
import { FaGavel } from "react-icons/fa";
import { MdVerified, MdWarning } from "react-icons/md";
import { useWallet } from "../contexts/WalletContext";
import Card from "../components/Common/Card";
import Button from "../components/Common/Button";
import LoadingSpinner from "../components/Common/LoadingSpinner";
import { ButtonVariants } from "../types";
import VerificationManagerABI from "../contracts/VerificationManager.json";
import AuthTokenABI from "../contracts/AuthToken.json";
import { CONTRACT_ADDRESSES } from "../utils/constants";

import DisputeResolutionABI from "../contracts/DisputeResolution.json";

const DisputeResolutionPage = () => {
  const { provider, isConnected, signer, account } = useWallet();

  const [verificationAttempts, setVerificationAttempts] = useState([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState(null);

  // Dispute states
  const [disputes, setDisputes] = useState([]);
  const [isLoadingDisputes, setIsLoadingDisputes] = useState(false);
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputeEvidence, setDisputeEvidence] = useState("");
  const [isCreatingDispute, setIsCreatingDispute] = useState(false);

  const formatAddress = (address) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Load all verification attempts and disputes on mount
  React.useEffect(() => {
    if (provider) {
      loadAllVerifications();
      loadAllDisputes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const loadAllVerifications = async () => {
    if (!provider) {
      return;
    }

    setIsLoadingAttempts(true);
    setVerificationAttempts([]);

    try {
      const verificationManagerAddress =
        CONTRACT_ADDRESSES.VERIFICATION_MANAGER ||
        process.env.REACT_APP_VERIFICATION_MANAGER_ADDRESS;

      if (
        !verificationManagerAddress ||
        verificationManagerAddress === "0x..."
      ) {
        throw new Error("VerificationManager address not configured");
      }

      const verificationManager = new ethers.Contract(
        verificationManagerAddress,
        VerificationManagerABI.abi,
        provider
      );

      // Fetch ALL verification attempts from VerificationCompleted events
      const attempts = [];
      const filter = verificationManager.filters.VerificationCompleted();
      const events = await verificationManager.queryFilter(filter);

      for (const event of events) {
        const request = await verificationManager.requests(
          event.args.requestId
        );
        const block = await event.getBlock();

        attempts.push({
          requestId: event.args.requestId,
          productId: request.productId,
          verifier: event.args.verifier,
          result: event.args.result,
          requester: request.requester,
          fee: ethers.formatEther(request.fee),
          timestamp: block.timestamp * 1000,
          blockNumber: event.blockNumber,
        });
      }

      // Sort by timestamp descending (newest first)
      attempts.sort((a, b) => b.timestamp - a.timestamp);

      setVerificationAttempts(attempts);

      toast.success(
        `Loaded ${attempts.length} verification attempt(s) from blockchain`
      );
    } catch (err) {
      console.error("Error loading verifications:", err);
      toast.error(err.message || "Failed to load verifications");
    } finally {
      setIsLoadingAttempts(false);
    }
  };

  const loadAllDisputes = async () => {
    if (!provider) {
      return;
    }

    setIsLoadingDisputes(true);

    try {
      const disputeAddress =
        CONTRACT_ADDRESSES.DISPUTE_RESOLUTION ||
        process.env.REACT_APP_DISPUTE_RESOLUTION_ADDRESS;

      if (!disputeAddress || disputeAddress === "0x...") {
        console.warn("DisputeResolution address not configured");
        return;
      }

      const disputeContract = new ethers.Contract(
        disputeAddress,
        DisputeResolutionABI.abi,
        provider
      );

      // Get all disputes from DisputeCreated events
      const disputeList = [];
      const filter = disputeContract.filters.DisputeCreated();
      const events = await disputeContract.queryFilter(filter);

      for (const event of events) {
        const disputeData = await disputeContract.disputes(
          event.args.disputeId
        );

        // DisputeStatus enum: 0=None, 1=Open, 2=UnderReview, 3=Resolved, 4=Rejected, 5=Expired
        const statusLabels = [
          "None",
          "Open",
          "Under Review",
          "Resolved",
          "Rejected",
          "Expired",
        ];

        disputeList.push({
          disputeId: event.args.disputeId,
          productId: disputeData.productId,
          initiator: event.args.initiator,
          description: disputeData.description,
          evidenceURI: disputeData.evidenceURI,
          status: Number(disputeData.status),
          statusLabel: statusLabels[Number(disputeData.status)],
          createdAt: Number(disputeData.createdAt) * 1000,
          resolvedAt: Number(disputeData.resolvedAt) * 1000,
          votesFor: Number(disputeData.votesFor),
          votesAgainst: Number(disputeData.votesAgainst),
          inFavor: disputeData.inFavor,
          blockNumber: event.blockNumber,
        });
      }

      // Sort by timestamp descending (newest first)
      disputeList.sort((a, b) => b.createdAt - a.createdAt);

      setDisputes(disputeList);
      console.log(`Loaded ${disputeList.length} dispute(s)`);
    } catch (err) {
      console.error("Error loading disputes:", err);
    } finally {
      setIsLoadingDisputes(false);
    }
  };

  const handleCreateDispute = async (productId) => {
    if (!signer || !isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!disputeDescription.trim()) {
      toast.error("Please provide a description of the issue");
      return;
    }

    if (!disputeEvidence.trim()) {
      toast.error("Please provide evidence URL (e.g., IPFS link, image URL)");
      return;
    }

    setIsCreatingDispute(true);

    try {
      const disputeAddress =
        CONTRACT_ADDRESSES.DISPUTE_RESOLUTION ||
        process.env.REACT_APP_DISPUTE_RESOLUTION_ADDRESS;
      const authAddress =
        CONTRACT_ADDRESSES.AUTH_TOKEN ||
        process.env.REACT_APP_AUTH_TOKEN_ADDRESS;

      if (!disputeAddress || disputeAddress === "0x...") {
        throw new Error("DisputeResolution contract not configured");
      }

      // DisputeResolutionABI is the full artifact, AuthTokenABI is already just the ABI array
      const disputeContract = new ethers.Contract(
        disputeAddress,
        DisputeResolutionABI.abi,
        signer
      );

      const authContract = new ethers.Contract(
        authAddress,
        AuthTokenABI,
        signer
      );

      // Get dispute fee and bond amount
      const disputeFee = await disputeContract.disputeFee();
      const bondAmount = await disputeContract.bondAmount();
      const totalCost = disputeFee + bondAmount;

      toast.info(
        `Total cost: ${ethers.formatEther(
          totalCost
        )} AUTH (${ethers.formatEther(disputeFee)} fee + ${ethers.formatEther(
          bondAmount
        )} bond)`
      );

      // Check balance
      const balance = await authContract.balanceOf(account);
      if (balance < totalCost) {
        throw new Error(
          `Insufficient AUTH balance. Need ${ethers.formatEther(
            totalCost
          )} AUTH`
        );
      }

      // Approve tokens
      toast.info("Approving AUTH tokens...");
      const approveTx = await authContract.approve(disputeAddress, totalCost);
      await approveTx.wait();

      // Create dispute
      toast.info("Creating dispute...");
      const tx = await disputeContract.createDispute(
        productId,
        disputeDescription,
        disputeEvidence
      );
      await tx.wait();

      toast.success(
        "Dispute created successfully! Arbiters will review your case."
      );

      // Reset form and close modal
      setDisputeDescription("");
      setDisputeEvidence("");
      setSelectedAttempt(null);

      // Reload disputes to show the new one
      loadAllDisputes();
    } catch (err) {
      console.error("Error creating dispute:", err);
      toast.error(err.message || "Failed to create dispute");
    } finally {
      setIsCreatingDispute(false);
    }
  };

  return (
    <div className="pt-20 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <FaGavel className="text-5xl text-orange-600" />
          <h1 className="text-4xl font-bold text-gray-900">
            Dispute Resolution
          </h1>
        </div>
        <p className="text-lg text-gray-600">
          Challenge fraudulent or incorrectly verified products
        </p>
      </div>

      {/* How It Works */}
      <Card className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">How It Works</h2>
        <div className="space-y-3 text-gray-700">
          <div className="flex gap-3">
            <span className="font-bold text-orange-600">1.</span>
            <span>
              Review verification attempts below and click "Dispute" on any
              result you believe is incorrect
            </span>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-orange-600">2.</span>
            <span>
              Provide a detailed description and evidence (photos, documents,
              etc.)
            </span>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-orange-600">3.</span>
            <span>Pay 15 AUTH (10 AUTH fee + 5 AUTH refundable bond)</span>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-orange-600">4.</span>
            <span>Arbiters vote on your dispute within 3 days</span>
          </div>
          <div className="flex gap-3">
            <span className="font-bold text-orange-600">5.</span>
            <span>
              <strong>If valid:</strong> Full 15 AUTH refund |{" "}
              <strong>If rejected:</strong> Lose 5 AUTH bond
            </span>
          </div>
        </div>
      </Card>

      {/* My Disputes Section */}
      {isLoadingDisputes ? (
        <Card className="mb-8">
          <div className="text-center py-8">
            <LoadingSpinner className="mx-auto mb-4" />
            <p className="text-gray-600">Loading disputes...</p>
          </div>
        </Card>
      ) : disputes.length > 0 ? (
        <Card className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            📋 All Disputes ({disputes.length})
          </h2>
          <div className="space-y-4">
            {disputes.map((dispute) => (
              <div
                key={dispute.disputeId}
                className={`p-4 rounded-lg border-2 ${
                  dispute.status === 1 || dispute.status === 2
                    ? "bg-yellow-50 border-yellow-300"
                    : dispute.status === 3
                    ? "bg-green-50 border-green-300"
                    : dispute.status === 4
                    ? "bg-red-50 border-red-300"
                    : "bg-gray-50 border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`px-4 py-1 rounded-full text-sm font-bold ${
                          dispute.status === 1
                            ? "bg-yellow-500 text-white"
                            : dispute.status === 2
                            ? "bg-blue-500 text-white"
                            : dispute.status === 3
                            ? "bg-green-600 text-white"
                            : dispute.status === 4
                            ? "bg-red-600 text-white"
                            : "bg-gray-500 text-white"
                        }`}
                      >
                        {dispute.statusLabel}
                      </span>
                      <span className="text-sm text-gray-500">
                        Filed: {new Date(dispute.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <strong className="text-gray-700">Product ID:</strong>
                        <div className="font-mono text-xs text-gray-600 mt-1">
                          {dispute.productId}
                        </div>
                      </div>
                      <div>
                        <strong className="text-gray-700">Initiator:</strong>
                        <div className="font-mono text-xs text-gray-600 mt-1">
                          {formatAddress(dispute.initiator)}
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <strong className="text-gray-700 text-sm">
                        Description:
                      </strong>
                      <p className="text-sm text-gray-600 mt-1">
                        {dispute.description}
                      </p>
                    </div>

                    {dispute.evidenceURI && (
                      <div className="mb-3">
                        <strong className="text-gray-700 text-sm">
                          Evidence:
                        </strong>
                        <a
                          href={dispute.evidenceURI}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline ml-2"
                        >
                          View Evidence →
                        </a>
                      </div>
                    )}

                    {/* Voting Status */}
                    {(dispute.status === 1 || dispute.status === 2) && (
                      <div className="mt-3 p-3 bg-white rounded border">
                        <strong className="text-sm text-gray-700">
                          Voting Status:
                        </strong>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="text-green-600">
                            👍 For: <strong>{dispute.votesFor}</strong>
                          </span>
                          <span className="text-red-600">
                            👎 Against: <strong>{dispute.votesAgainst}</strong>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Resolution Result */}
                    {(dispute.status === 3 || dispute.status === 4) && (
                      <div className="mt-3 p-3 bg-white rounded border">
                        <div className="flex justify-between items-center">
                          <div>
                            <strong className="text-sm text-gray-700">
                              Final Result:
                            </strong>
                            <div className="text-sm mt-1">
                              <span className="text-green-600">
                                👍 For: <strong>{dispute.votesFor}</strong>
                              </span>
                              {" vs "}
                              <span className="text-red-600">
                                👎 Against:{" "}
                                <strong>{dispute.votesAgainst}</strong>
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            {dispute.status === 3 ? (
                              <div className="text-green-600 font-bold">
                                ✓ Dispute Valid
                                <br />
                                <span className="text-xs">
                                  Full Refund: 15 AUTH
                                </span>
                              </div>
                            ) : (
                              <div className="text-red-600 font-bold">
                                ✗ Dispute Rejected
                                <br />
                                <span className="text-xs">
                                  Bond Forfeited: 5 AUTH
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        {dispute.resolvedAt > 0 && (
                          <div className="text-xs text-gray-500 mt-2">
                            Resolved:{" "}
                            {new Date(dispute.resolvedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* All Verification Attempts */}
      {isLoadingAttempts ? (
        <Card>
          <div className="text-center py-12">
            <LoadingSpinner className="mx-auto mb-4" />
            <p className="text-gray-600">Loading verification attempts...</p>
          </div>
        </Card>
      ) : verificationAttempts.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <MdWarning className="text-6xl mx-auto mb-4 text-gray-300" />
            <p className="text-lg">
              No verification attempts found on blockchain
            </p>
            <p className="text-sm mt-2">
              Products need to be verified first before disputes can be filed
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-6 text-right">
            <span className="text-sm text-gray-600">
              Total: <strong>{verificationAttempts.length}</strong> verification
              {verificationAttempts.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-4">
            {verificationAttempts.map((attempt) => (
              <Card
                key={attempt.requestId}
                className="hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {attempt.result ? (
                      <MdVerified className="text-3xl text-green-600 mt-1 flex-shrink-0" />
                    ) : (
                      <MdWarning className="text-3xl text-red-600 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className={`px-4 py-1 rounded-full text-sm font-bold ${
                            attempt.result
                              ? "bg-green-600 text-white"
                              : "bg-red-600 text-white"
                          }`}
                        >
                          {attempt.result ? "✓ VERIFIED" : "✗ FAILED"}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(attempt.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                        <div>
                          <strong className="text-gray-700">Product ID:</strong>
                          <div className="font-mono text-xs text-gray-600 mt-1">
                            {attempt.productId}
                          </div>
                        </div>
                        <div>
                          <strong className="text-gray-700">Verifier:</strong>
                          <div className="font-mono text-xs text-gray-600 mt-1">
                            {formatAddress(attempt.verifier)}
                          </div>
                        </div>
                        <div>
                          <strong className="text-gray-700">Requester:</strong>
                          <div className="font-mono text-xs text-gray-600 mt-1">
                            {formatAddress(attempt.requester)}
                          </div>
                        </div>
                        <div>
                          <strong className="text-gray-700">Fee:</strong>
                          <div className="text-xs text-gray-600 mt-1">
                            {attempt.fee} AUTH
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500">
                        Request ID: {attempt.requestId.slice(0, 10)}...
                        {attempt.requestId.slice(-8)}
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <Button
                      variant={ButtonVariants.PRIMARY}
                      onClick={() => setSelectedAttempt(attempt)}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <AiOutlineFlag className="inline mr-2" />
                      Dispute
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Dispute Modal */}
      {selectedAttempt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-900">File Dispute</h2>
              <button
                onClick={() => setSelectedAttempt(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Selected verification info */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">
                Disputing Verification:
              </h3>
              <div className="text-sm space-y-1">
                <div>
                  <strong>Product ID:</strong>{" "}
                  <span className="font-mono text-xs">
                    {selectedAttempt.productId}
                  </span>
                </div>
                <div>
                  <strong>Result:</strong>{" "}
                  <span
                    className={`font-bold ${
                      selectedAttempt.result ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {selectedAttempt.result ? "VERIFIED" : "FAILED"}
                  </span>
                </div>
                <div>
                  <strong>Verifier:</strong>{" "}
                  <span className="font-mono text-xs">
                    {formatAddress(selectedAttempt.verifier)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">
                ⚠️ Important Information
              </h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>
                  • <strong>Cost:</strong> 15 AUTH (10 AUTH fee + 5 AUTH bond)
                </li>
                <li>
                  • <strong>If valid:</strong> You get full 15 AUTH refund
                </li>
                <li>
                  • <strong>If rejected:</strong> You lose the 5 AUTH bond
                  (penalty for false claims)
                </li>
                <li>
                  • <strong>Voting period:</strong> 3 days for arbiters to
                  review
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description of Issue *
                </label>
                <textarea
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Explain why you believe this verification result is incorrect..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={5}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Evidence URL *
                </label>
                <input
                  type="text"
                  value={disputeEvidence}
                  onChange={(e) => setDisputeEvidence(e.target.value)}
                  placeholder="ipfs://... or https://... (photos, documents, receipts, etc.)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Provide an IPFS link or URL to photos, documents, receipts, or
                  other evidence supporting your claim
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant={ButtonVariants.SECONDARY}
                onClick={() => setSelectedAttempt(null)}
                className="flex-1"
                disabled={isCreatingDispute}
              >
                Cancel
              </Button>
              <Button
                variant={ButtonVariants.PRIMARY}
                onClick={() => handleCreateDispute(selectedAttempt.productId)}
                disabled={
                  isCreatingDispute ||
                  !disputeDescription.trim() ||
                  !disputeEvidence.trim()
                }
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {isCreatingDispute ? (
                  <>
                    <LoadingSpinner className="inline mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <AiOutlineFlag className="inline mr-2" />
                    Submit (Pay 15 AUTH)
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DisputeResolutionPage;
