const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Complete Verifications Only
 * Assumes verifiers are already assigned
 */

async function main() {
  console.log("\n✅ Complete Verifications (Mixed Results)\n");

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

  if (!vmAddress || !authAddress) {
    console.error("❌ Contract addresses not found in frontend/.env");
    return;
  }

  const VerificationManager = await hre.ethers.getContractFactory(
    "VerificationManager"
  );
  const AuthToken = await hre.ethers.getContractFactory("AuthToken");
  
  const vm = VerificationManager.attach(vmAddress);
  const auth = AuthToken.attach(authAddress);

  // Get all verification requests
  const filter = vm.filters.VerificationRequested();
  const events = await vm.queryFilter(filter);

  if (events.length === 0) {
    console.log("❌ No verification requests found.");
    return;
  }

  console.log(`📋 Found ${events.length} verification request(s)\n`);

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
        console.log(`⚠️  Request ${requestId}: No verifier assigned, skipping`);
        continue;
      }

      console.log(`\n🔍 Request: ${requestId}`);
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
        console.log(`   ⚠️  Verifier signer not found`);
        continue;
      }

      // Get balances before
      const verifierBalanceBefore = await auth.balanceOf(verifierAddress);

      // Alternate between verified and failed (first = verified, second = failed, etc.)
      const isVerified = completed % 2 === 0;
      const evidenceURI = isVerified 
        ? `ipfs://QmVerified${Date.now()}` 
        : `ipfs://QmFailed${Date.now()}`;
      
      await (
        await vm
          .connect(verifierSigner)
          .completeVerification(requestId, isVerified, evidenceURI)
      ).wait();

      // Get balances after
      const verifierBalanceAfter = await auth.balanceOf(verifierAddress);
      const feeReceived = verifierBalanceAfter - verifierBalanceBefore;

      if (isVerified) {
        console.log(`   ✅ VERIFIED`);
        console.log(`   💰 Verifier received: ${hre.ethers.formatEther(feeReceived)} AUTH`);
        verified++;
      } else {
        console.log(`   ❌ FAILED VERIFICATION`);
        console.log(`   💰 Verifier received: ${hre.ethers.formatEther(feeReceived)} AUTH`);
        failed++;
      }
      
      completed++;
    } catch (e) {
      console.log(`   ⚠️  Error: ${e.message}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`   Total Requests: ${events.length}`);
  console.log(`   ✅ Verified (Authentic): ${verified}`);
  console.log(`   ❌ Failed Verification: ${failed}`);
  console.log(`   ⏭️  Skipped (already done): ${skipped}`);
  console.log("=".repeat(60));
  console.log("\n✨ Done! Check the Verification Center to see results and fee distribution.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
