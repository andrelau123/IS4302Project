const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n[CHECK] Checking All Disputes...\n");

  // Get deployed contract addresses
  const envPath = path.join(__dirname, "..", "frontend", ".env");
  const envContent = fs.readFileSync(envPath, "utf8");

  const disputeMatch = envContent.match(
    /REACT_APP_DISPUTE_RESOLUTION_ADDRESS=(.+)/
  );
  const disputeAddress = disputeMatch[1].trim();

  console.log("[ADDRESS] DisputeResolution:", disputeAddress, "\n");

  const DisputeResolution = await hre.ethers.getContractFactory(
    "DisputeResolution"
  );
  const dispute = DisputeResolution.attach(disputeAddress);

  // Get all disputes
  const disputeFilter = dispute.filters.DisputeCreated();
  const allDisputes = await dispute.queryFilter(disputeFilter);

  console.log(`[INFO] Found ${allDisputes.length} total dispute(s)\n`);
  console.log("=".repeat(80));

  for (let i = 0; i < allDisputes.length; i++) {
    const event = allDisputes[i];
    const disputeId = event.args.disputeId;
    const disputeDetails = await dispute.disputes(disputeId);

    const statusNames = {
      0: "None",
      1: "Open",
      2: "UnderReview",
      3: "Resolved",
      4: "Rejected",
      5: "Expired",
    };

    console.log(`\n[DISPUTE ${i + 1}]`);
    console.log(`   ID: ${disputeId}`);
    console.log(`   Product: ${disputeDetails.productId}`);
    console.log(`   Initiator: ${disputeDetails.initiator}`);
    console.log(
      `   Status: ${statusNames[Number(disputeDetails.status)]} (${disputeDetails.status})`
    );
    console.log(`   Votes For: ${disputeDetails.votesFor}`);
    console.log(`   Votes Against: ${disputeDetails.votesAgainst}`);
    console.log(`   In Favor: ${disputeDetails.inFavor}`);
    console.log(`   Created At: ${new Date(Number(disputeDetails.createdAt) * 1000).toLocaleString()}`);
    console.log(`   Description: ${disputeDetails.description}`);

    // Check if needs voting
    const requiredVotes = await dispute.requiredVotes();
    const needsVoting =
      (disputeDetails.status === 1n || disputeDetails.status === 2n) &&
      disputeDetails.votesFor < requiredVotes &&
      disputeDetails.votesAgainst < requiredVotes;

    if (needsVoting) {
      console.log(`   ⚠️  NEEDS VOTING! (Requires ${requiredVotes} votes)`);
    } else if (disputeDetails.status === 3n) {
      console.log(`   ✅ RESOLVED`);
    } else if (disputeDetails.status === 4n) {
      console.log(`   ❌ REJECTED`);
    }
  }

  console.log("\n" + "=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
