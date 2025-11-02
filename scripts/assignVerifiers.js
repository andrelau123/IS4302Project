const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🔍 Assigning Verifiers to Pending Requests...\n");

  const signers = await hre.ethers.getSigners();
  const admin = signers[0]; // Account 0 has DEFAULT_ADMIN_ROLE

  // Get deployed contract address
  const envPath = path.join(__dirname, "..", "frontend", ".env");
  const envContent = fs.readFileSync(envPath, "utf8");
  const vmMatch = envContent.match(
    /REACT_APP_VERIFICATION_MANAGER_ADDRESS=(.+)/
  );
  const vmAddress = vmMatch[1].trim();

  console.log("📍 VerificationManager:", vmAddress);
  console.log("🔑 Admin:", admin.address, "\n");

  const VerificationManager = await hre.ethers.getContractFactory(
    "VerificationManager"
  );
  const vm = VerificationManager.attach(vmAddress);

  // Get all VerificationRequested events
  const filter = vm.filters.VerificationRequested();
  const events = await vm.queryFilter(filter);

  if (events.length === 0) {
    console.log("❌ No verification requests found.");
    console.log("\n💡 Create a verification request first from the frontend!");
    return;
  }

  console.log(`📋 Found ${events.length} verification request(s)\n`);

  // Check for available verifiers (accounts 10-15)
  const VERIFIER_ROLE = await vm.VERIFIER_ROLE();
  const potentialVerifiers = [
    signers[10],
    signers[11],
    signers[12],
    signers[13],
    signers[14],
    signers[15],
  ];
  const availableVerifiers = [];

  console.log("👥 Checking for available verifiers...");
  for (let i = 0; i < potentialVerifiers.length; i++) {
    const accountNum = i + 10;
    const verifier = potentialVerifiers[i];
    const hasRole = await vm.hasRole(VERIFIER_ROLE, verifier.address);
    if (hasRole) {
      const verifierInfo = await vm.verifiers(verifier.address);
      if (verifierInfo.isActive) {
        availableVerifiers.push(verifier);
        console.log(`   ✅ Account ${accountNum}: ${verifier.address}`);
      }
    }
  }

  if (availableVerifiers.length === 0) {
    console.log("\n❌ No active verifiers found!");
    console.log(
      "\n💡 Verifiers (accounts 10-15) should be automatically registered during deployment."
    );
    console.log("   If not, redeploy with: npm run deploy");
    return;
  }

  console.log(`\n✅ Found ${availableVerifiers.length} active verifier(s)\n`);
  console.log("=".repeat(60));

  // Process each request
  let assigned = 0;
  let skipped = 0;

  for (const event of events) {
    const requestId = event.args.requestId;
    const productId = event.args.productId;
    const requester = event.args.requester;

    console.log(`\n📝 Request ID: ${requestId}`);
    console.log(`   Product: ${productId}`);
    console.log(`   Requester: ${requester}`);

    try {
      // Check if already assigned or completed
      const request = await vm.requests(requestId);

      if (request.completed) {
        console.log(`   ✓ Already completed (result: ${request.result})`);
        skipped++;
        continue;
      }

      if (request.assignedVerifier !== hre.ethers.ZeroAddress) {
        console.log(`   ⏳ Already assigned to: ${request.assignedVerifier}`);
        skipped++;
        continue;
      }

      // Assign to first available verifier (round-robin)
      const verifier = availableVerifiers[assigned % availableVerifiers.length];

      console.log(`   🔗 Assigning to verifier: ${verifier.address}...`);
      const tx = await vm
        .connect(admin)
        .assignVerifier(requestId, verifier.address);
      await tx.wait();
      console.log(`   ✅ ASSIGNED!`);
      assigned++;
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      skipped++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Summary:");
  console.log(`   ✅ Assigned: ${assigned}`);
  console.log(`   ⏭  Skipped: ${skipped}`);
  console.log(`   📋 Total: ${events.length}`);

  if (assigned > 0) {
    console.log("\n🎉 Verifiers assigned successfully!");
    console.log("\n💡 Next steps:");
    console.log("   1. Verifiers can now complete the verifications");
    console.log(
      "   2. Run: npx hardhat run scripts/completeVerification.js --network localhost"
    );
    console.log("   3. Or check the frontend to see updated status");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
