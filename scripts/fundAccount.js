// Script to fund an account with ETH from Hardhat test accounts
const { ethers } = require("hardhat");

async function main() {
  // Target address and amount
  const targetAddress = "0x05a20a51a39c93d3bfdc4c26406fbcf9561cdab9";
  const amountInEth = "9000"; // Sending 9000 ETH

  console.log(`\n🎯 Target Address: ${targetAddress}`);
  console.log(`💰 Amount to send: ${amountInEth} ETH\n`);

  // Get signers (Hardhat test accounts)
  const [deployer] = await ethers.getSigners();
  
  console.log(`📤 Sending from: ${deployer.address}`);
  
  // Check sender balance before
  const senderBalanceBefore = await ethers.provider.getBalance(deployer.address);
  console.log(`Sender balance before: ${ethers.formatEther(senderBalanceBefore)} ETH`);

  // Check target balance before
  const targetBalanceBefore = await ethers.provider.getBalance(targetAddress);
  console.log(`Target balance before: ${ethers.formatEther(targetBalanceBefore)} ETH`);

  // Send ETH
  console.log(`\n⏳ Sending ${amountInEth} ETH...`);
  const tx = await deployer.sendTransaction({
    to: targetAddress,
    value: ethers.parseEther(amountInEth)
  });

  console.log(`📝 Transaction hash: ${tx.hash}`);
  
  // Wait for confirmation
  await tx.wait();
  console.log(`✅ Transaction confirmed!`);

  // Check balances after
  const senderBalanceAfter = await ethers.provider.getBalance(deployer.address);
  const targetBalanceAfter = await ethers.provider.getBalance(targetAddress);

  console.log(`\n📊 Final Balances:`);
  console.log(`Sender balance after: ${ethers.formatEther(senderBalanceAfter)} ETH`);
  console.log(`Target balance after: ${ethers.formatEther(targetBalanceAfter)} ETH`);
  
  console.log(`\n🎉 Successfully sent ${amountInEth} ETH to ${targetAddress}!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

