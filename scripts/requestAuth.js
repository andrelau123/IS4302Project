const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Get the account that needs AUTH tokens
  const recipientAddress = process.argv[2];

  if (!recipientAddress) {
    console.log("\n❌ Error: Please provide a recipient address");
    console.log(
      "Usage: npx hardhat run scripts/requestAuth.js --network localhost <address>\n"
    );
    process.exit(1);
  }

  console.log("\n[REQUEST AUTH] Transferring AUTH tokens...\n");

  const signers = await hre.ethers.getSigners();
  const admin = signers[0]; // Account 0 has all the AUTH tokens

  // Get deployed contract address
  const envPath = path.join(__dirname, "..", "frontend", ".env");
  const envContent = fs.readFileSync(envPath, "utf8");
  const authMatch = envContent.match(/REACT_APP_AUTH_TOKEN_ADDRESS=(.+)/);
  const authAddress = authMatch[1].trim();

  console.log("[ADDRESS] AuthToken:", authAddress);
  console.log("[ADMIN] Admin:", admin.address);
  console.log("[RECIPIENT] Recipient:", recipientAddress, "\n");

  const AuthToken = await hre.ethers.getContractFactory("AuthToken");
  const authToken = AuthToken.attach(authAddress);

  // Check current balance
  const balanceBefore = await authToken.balanceOf(recipientAddress);
  console.log(
    `[BALANCE] Current balance: ${hre.ethers.formatEther(balanceBefore)} AUTH\n`
  );

  // Transfer 100 AUTH
  const amount = hre.ethers.parseEther("100");
  console.log(`[TRANSFER] Sending 100 AUTH...`);

  const tx = await authToken.connect(admin).transfer(recipientAddress, amount);
  await tx.wait();

  console.log(`[SUCCESS] Transaction confirmed!`);

  // Check new balance
  const balanceAfter = await authToken.balanceOf(recipientAddress);
  console.log(
    `\n[BALANCE] New balance: ${hre.ethers.formatEther(balanceAfter)} AUTH`
  );
  console.log(`[CHANGE] +${hre.ethers.formatEther(amount)} AUTH\n`);

  console.log("✅ AUTH tokens sent successfully!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
