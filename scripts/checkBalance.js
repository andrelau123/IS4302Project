const { ethers } = require("hardhat");

async function main() {
  const address = "0x05a20a51a39c93d3bfdc4c26406fbcf9561cdab9";
  
  console.log("\n🔍 Checking balance for:", address);
  
  const balance = await ethers.provider.getBalance(address);
  console.log("Balance (wei):", balance.toString());
  console.log("Balance (ETH):", ethers.formatEther(balance));
  
  // Check block number
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log("\nCurrent block:", blockNumber);
  
  // Check network
  const network = await ethers.provider.getNetwork();
  console.log("Chain ID:", network.chainId.toString());
}

main().catch(console.error);

