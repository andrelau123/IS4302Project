const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n[DISPUTE] Managing Disputes and Voting...\n");

  const signers = await hre.ethers.getSigners();
  const admin = signers[0];
  const consumer = signers[5]; // Consumer who will dispute

  // Get deployed contract addresses
  const envPath = path.join(__dirname, "..", "frontend", ".env");
  const envContent = fs.readFileSync(envPath, "utf8");

  const disputeMatch = envContent.match(
    /REACT_APP_DISPUTE_RESOLUTION_ADDRESS=(.+)/
  );
  const vmMatch = envContent.match(
    /REACT_APP_VERIFICATION_MANAGER_ADDRESS=(.+)/
  );
  const authMatch = envContent.match(/REACT_APP_AUTH_TOKEN_ADDRESS=(.+)/);

  const disputeAddress = disputeMatch[1].trim();
  const vmAddress = vmMatch[1].trim();
  const authAddress = authMatch[1].trim();

  console.log("[ADDRESS] DisputeResolution:", disputeAddress);
  console.log("[ADDRESS] VerificationManager:", vmAddress);
  console.log("[ADDRESS] AuthToken:", authAddress);
  console.log("[CONSUMER] Consumer:", consumer.address, "\n");

  const DisputeResolution = await hre.ethers.getContractFactory(
    "DisputeResolution"
  );
  const VerificationManager = await hre.ethers.getContractFactory(
    "VerificationManager"
  );
  const AuthToken = await hre.ethers.getContractFactory("AuthToken");

  const dispute = DisputeResolution.attach(disputeAddress);
  const vm = VerificationManager.attach(vmAddress);
  const authToken = AuthToken.attach(authAddress);

  // Get all completed verifications
  const verificationFilter = vm.filters.VerificationCompleted();
  const verificationEvents = await vm.queryFilter(verificationFilter);

  if (verificationEvents.length === 0) {
    console.log("[ERROR] No completed verifications found!");
    console.log(
      "\n[TIP] Run: npx hardhat run scripts/completeVerifications.js --network localhost"
    );
    return;
  }

  console.log(
    `[INFO] Found ${verificationEvents.length} completed verification(s)\n`
  );

  // Check for existing disputes
  const disputeFilter = dispute.filters.DisputeCreated();
  const existingDisputes = await dispute.queryFilter(disputeFilter);

  console.log(`[INFO] Found ${existingDisputes.length} existing dispute(s)\n`);
  console.log("=".repeat(60));

  // If no disputes exist, create one
  let disputeId;
  if (existingDisputes.length === 0) {
    console.log("\n[CREATING] Creating a new dispute...\n");

    const firstVerification = verificationEvents[0];
    const productId = firstVerification.args.productId;
    const requestId = firstVerification.args.requestId;
    const result = firstVerification.args.result;

    console.log(`[VERIFICATION] Product ID: ${productId}`);
    console.log(`[VERIFICATION] Request ID: ${requestId}`);
    console.log(`[VERIFICATION] Result: ${result}`);

    // Fund consumer with AUTH tokens
    const disputeFee = await dispute.disputeFee();
    const bondAmount = await dispute.bondAmount();
    const totalCost = disputeFee + bondAmount;

    console.log(
      `\n[FUNDING] Funding consumer with ${hre.ethers.formatEther(
        totalCost
      )} AUTH...`
    );
    let tx = await authToken
      .connect(admin)
      .transfer(consumer.address, totalCost);
    await tx.wait();
    console.log("[SUCCESS] Consumer funded!");

    // Approve DisputeResolution to spend AUTH
    console.log(
      `[APPROVING] Approving ${hre.ethers.formatEther(totalCost)} AUTH...`
    );
    tx = await authToken.connect(consumer).approve(disputeAddress, totalCost);
    await tx.wait();
    console.log("[SUCCESS] Approval granted!");

    // Create dispute
    console.log("\n[DISPUTING] Filing dispute...");
    tx = await dispute
      .connect(consumer)
      .createDispute(
        productId,
        requestId,
        "This verification result is incorrect. The product authenticity is questionable.",
        "QmExampleIPFSHashForEvidence123456789"
      );
    const receipt = await tx.wait();

    // Get dispute ID from event
    const disputeCreatedEvent = receipt.logs.find(
      (log) => log.fragment && log.fragment.name === "DisputeCreated"
    );
    disputeId = disputeCreatedEvent.args.disputeId;

    console.log(`[SUCCESS] Dispute created! ID: ${disputeId}\n`);
  } else {
    // Find an unresolved dispute (Open or UnderReview)
    let foundUnresolved = false;
    for (const disputeEvent of existingDisputes) {
      const checkDisputeId = disputeEvent.args.disputeId;
      const checkDetails = await dispute.disputes(checkDisputeId);

      // Check if dispute is still open for voting
      if (checkDetails.status === 1n || checkDetails.status === 2n) {
        disputeId = checkDisputeId;
        foundUnresolved = true;
        console.log(`\n[EXISTING] Using unresolved dispute: ${disputeId}\n`);
        break;
      }
    }

    if (!foundUnresolved) {
      console.log(
        "\n[INFO] All existing disputes are already resolved/rejected."
      );
      console.log(
        "[TIP] Create a new dispute from the frontend to test voting.\n"
      );
      return;
    }
  }

  // Get dispute details
  const disputeDetails = await dispute.disputes(disputeId);
  console.log("=".repeat(60));
  console.log("\n[DISPUTE DETAILS]");
  console.log(`   ID: ${disputeId}`);
  console.log(`   Product: ${disputeDetails.productId}`);
  console.log(`   Initiator: ${disputeDetails.initiator}`);
  console.log(
    `   Status: ${disputeDetails.status} (0=None, 1=Open, 2=UnderReview, 3=Resolved, 4=Rejected, 5=Expired)`
  );
  console.log(`   Votes For: ${disputeDetails.votesFor}`);
  console.log(`   Votes Against: ${disputeDetails.votesAgainst}`);
  console.log(`   Description: ${disputeDetails.description}\n`);

  // Check if dispute is still open for voting
  if (disputeDetails.status !== 1n && disputeDetails.status !== 2n) {
    console.log(
      "[INFO] Dispute is already resolved/rejected/expired. Status:",
      disputeDetails.status.toString()
    );
    return;
  }

  // Get active verifiers (they are the arbiters now)
  const VERIFIER_ROLE = await vm.VERIFIER_ROLE();
  const potentialVerifiers = [
    signers[10],
    signers[11],
    signers[12],
    signers[13],
    signers[14],
    signers[15],
  ];

  const activeVerifiers = [];
  console.log("=".repeat(60));
  console.log("\n[VERIFIERS] Checking for active verifiers (arbiters)...");

  for (let i = 0; i < potentialVerifiers.length; i++) {
    const accountNum = i + 10;
    const verifier = potentialVerifiers[i];
    const hasRole = await vm.hasRole(VERIFIER_ROLE, verifier.address);
    if (hasRole) {
      const verifierInfo = await vm.verifiers(verifier.address);
      if (verifierInfo.isActive) {
        activeVerifiers.push(verifier);
        console.log(`   [ACTIVE] Account ${accountNum}: ${verifier.address}`);
      }
    }
  }

  if (activeVerifiers.length === 0) {
    console.log("\n[ERROR] No active verifiers found to vote!");
    return;
  }

  console.log(
    `\n[INFO] Found ${activeVerifiers.length} active verifier(s) who can vote\n`
  );
  console.log("=".repeat(60));

  // Have verifiers vote on the dispute
  const requiredVotes = await dispute.requiredVotes();
  console.log(`\n[VOTING] Required votes to resolve: ${requiredVotes}\n`);

  let votesFor = 0;
  let votesAgainst = 0;
  let votedCount = 0;

  for (let i = 0; i < activeVerifiers.length; i++) {
    const verifier = activeVerifiers[i];
    const accountNum = i + 10;

    try {
      // Check if already voted
      const hasVoted = await dispute.hasVoted(disputeId, verifier.address);
      if (hasVoted) {
        console.log(`[SKIPPED] Account ${accountNum} already voted`);
        continue;
      }

      // Vote FOR to reach quorum (all remaining votes go FOR)
      const voteInFavor = true; // Vote FOR to resolve dispute

      console.log(`[VOTING] Account ${accountNum} (${verifier.address})`);
      console.log(`   Vote: ${voteInFavor ? "IN FAVOR ✓" : "AGAINST ✗"}`);

      const tx = await dispute
        .connect(verifier)
        .voteOnDispute(disputeId, voteInFavor);
      await tx.wait();

      if (voteInFavor) votesFor++;
      else votesAgainst++;

      console.log(`   [SUCCESS] Vote recorded!\n`);

      // Check if dispute was auto-resolved
      const updatedDispute = await dispute.disputes(disputeId);
      if (updatedDispute.status === 3n) {
        console.log("🎉 [RESOLVED] Dispute automatically resolved!");
        console.log(`   Result: In Favor = ${updatedDispute.inFavor}`);
        console.log(
          `   Final Votes: ${updatedDispute.votesFor} FOR, ${updatedDispute.votesAgainst} AGAINST`
        );
        break;
      } else if (updatedDispute.status === 4n) {
        console.log("❌ [REJECTED] Dispute automatically rejected!");
        console.log(`   Result: In Favor = ${updatedDispute.inFavor}`);
        console.log(
          `   Final Votes: ${updatedDispute.votesFor} FOR, ${updatedDispute.votesAgainst} AGAINST`
        );
        break;
      }
    } catch (err) {
      console.error(`   [ERROR] Failed to vote: ${err.message}\n`);
    }
  }

  // Final dispute status
  console.log("=".repeat(60));
  const finalDispute = await dispute.disputes(disputeId);
  console.log("\n[FINAL STATUS]");
  console.log(
    `   Status: ${finalDispute.status} (1=Open, 2=UnderReview, 3=Resolved, 4=Rejected)`
  );
  console.log(`   Votes For: ${finalDispute.votesFor}`);
  console.log(`   Votes Against: ${finalDispute.votesAgainst}`);
  console.log(`   In Favor: ${finalDispute.inFavor}`);

  if (finalDispute.status === 3n || finalDispute.status === 4n) {
    console.log(
      `\n✅ [COMPLETE] Dispute has been ${
        finalDispute.status === 3n ? "resolved" : "rejected"
      }!`
    );
    console.log(`   Winning voters received 3 AUTH reward each`);
  } else {
    console.log(
      `\n⏳ [PENDING] Dispute needs ${
        requiredVotes - finalDispute.votesFor
      } more votes to resolve`
    );
  }

  console.log(
    "\n[TIP] Check the frontend Dispute Resolution page to see the results!"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
