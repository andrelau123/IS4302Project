const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Complete Verifications Only
 * Assumes verifiers are already assigned
 */

async function main() {
  console.log("\n[VERIFICATION] Complete Verifications (Mixed Results)\n");

  const signers = await hre.ethers.getSigners();

  // Read contract addresses
  const envPath = path.join(__dirname, "..", "frontend", ".env");
  const envContent = fs.readFileSync(envPath, "utf8");

  const vmAddress = envContent
    .match(/REACT_APP_VERIFICATION_MANAGER_ADDRESS=(.+)/)?.[1]
    ?.trim();
  const authAddress = envContent
    .match(/REACT_APP_AUTH_TOKEN_ADDRESS=(.+)/)?.[1]
    ?.trim();
  const prAddress = envContent
    .match(/REACT_APP_PRODUCT_REGISTRY_ADDRESS=(.+)/)?.[1]
    ?.trim();

  if (!vmAddress || !authAddress || !prAddress) {
    console.error("[ERROR] Contract addresses not found in frontend/.env");
    return;
  }

  const VerificationManager = await hre.ethers.getContractFactory(
    "VerificationManager"
  );
  const AuthToken = await hre.ethers.getContractFactory("AuthToken");
  const ProductRegistry = await hre.ethers.getContractFactory(
    "ProductRegistry"
  );

  const vm = VerificationManager.attach(vmAddress);
  const auth = AuthToken.attach(authAddress);
  const pr = ProductRegistry.attach(prAddress);

  // Get admin for granting roles
  const admin = signers[0];

  // Get VERIFIER_ROLE from ProductRegistry
  const PR_VERIFIER_ROLE = await pr.VERIFIER_ROLE();

  // Check and grant VERIFIER_ROLE to all verifiers on ProductRegistry
  console.log("[SETUP] Ensuring verifiers have ProductRegistry access...");
  const potentialVerifiers = [
    signers[10],
    signers[11],
    signers[12],
    signers[13],
    signers[14],
    signers[15],
  ];

  for (const verifier of potentialVerifiers) {
    try {
      const hasRole = await pr.hasRole(PR_VERIFIER_ROLE, verifier.address);
      if (!hasRole) {
        await (
          await pr.connect(admin).grantRole(PR_VERIFIER_ROLE, verifier.address)
        ).wait();
        console.log(`   [GRANTED] VERIFIER_ROLE to ${verifier.address}`);
      }
    } catch (e) {
      // Ignore errors for verifiers that don't exist
    }
  }
  console.log("[SETUP] Complete\n");

  // Get all verification requests
  const filter = vm.filters.VerificationRequested();
  const events = await vm.queryFilter(filter);

  if (events.length === 0) {
    console.log("[INFO] No verification requests found.");
    return;
  }

  console.log(`[INFO] Found ${events.length} verification request(s)\n`);

  let completed = 0;
  let skipped = 0;
  let verified = 0;
  let failed = 0;

  for (const event of events) {
    const requestId = event.args.requestId;

    try {
      const request = await vm.requests(requestId);

      // Skip if already completed
      if (request.completed) {
        skipped++;
        continue;
      }

      // Skip if not assigned
      if (request.assignedVerifier === hre.ethers.ZeroAddress) {
        console.log(
          `[WARNING] Request ${requestId}: No verifier assigned, skipping`
        );
        continue;
      }

      console.log(`\n[REQUEST] ${requestId}`);
      console.log(`   Product: ${request.productId}`);
      console.log(`   Requester: ${request.requester}`);
      console.log(`   Verifier: ${request.assignedVerifier}`);
      console.log(`   Fee: ${hre.ethers.formatEther(request.fee)} AUTH`);

      // Find the verifier signer
      const verifierAddress = request.assignedVerifier;
      const verifierSigner = signers.find(
        (s) => s.address.toLowerCase() === verifierAddress.toLowerCase()
      );

      if (!verifierSigner) {
        console.log(`   [WARNING] Verifier signer not found`);
        continue;
      }

      // Get balances before
      const verifierBalanceBefore = await auth.balanceOf(verifierAddress);

      // Alternate between verified and failed (first = verified, second = failed, etc.)
      const isVerified = completed % 2 === 0;

      // Failure reasons for failed verifications
      const failureReasons = [
        "Counterfeit product detected - Packaging inconsistencies",
        "Serial number mismatch - Does not match manufacturer records",
        "Tampered security seal - Signs of unauthorized access",
        "Incomplete documentation - Missing authenticity certificates",
        "Material analysis failed - Substandard components detected",
        "Barcode verification failed - Invalid or duplicated code",
        "Quality control failure - Product does not meet standards",
        "Suspicious origin - Supply chain verification failed",
      ];

      const failureReason = failureReasons[completed % failureReasons.length];
      const evidenceURI = isVerified
        ? `ipfs://QmVerified${Date.now()}`
        : `ipfs://QmFailed${Date.now()}#reason=${encodeURIComponent(
            failureReason
          )}`;

      // Complete verification in VerificationManager
      // Note: completeVerification now automatically calls recordVerification if result is true
      await (
        await vm
          .connect(verifierSigner)
          .completeVerification(requestId, isVerified, evidenceURI)
      ).wait();

      // Get balances after
      const verifierBalanceAfter = await auth.balanceOf(verifierAddress);
      const feeReceived = verifierBalanceAfter - verifierBalanceBefore;

      if (isVerified) {
        console.log(`   [VERIFIED] ✓ Product authenticated`);
        console.log(
          `   [FEE] Verifier received: ${hre.ethers.formatEther(
            feeReceived
          )} AUTH`
        );
        verified++;
      } else {
        console.log(`   [FAILED] ✗ Verification failed`);
        console.log(`   [REASON] ${failureReason}`);
        console.log(
          `   [FEE] Verifier received: ${hre.ethers.formatEther(
            feeReceived
          )} AUTH`
        );
        failed++;
      }

      completed++;
    } catch (e) {
      console.log(`   [ERROR] ${e.message}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("[SUMMARY]");
  console.log(`   Total Requests: ${events.length}`);
  console.log(`   Verified (Authentic): ${verified}`);
  console.log(`   Failed Verification: ${failed}`);
  console.log(`   Skipped (already done): ${skipped}`);
  console.log("=".repeat(60));
  console.log(
    "\n✨ Done! Check the Verification Center to see results and fee distribution."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
