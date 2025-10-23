const { ethers } = require('hardhat');

async function main() {
  const fs = require('fs');
  const path = require('path');
  const dataPath = path.join(__dirname, '..', 'frontend', 'src', 'data', 'demoRetailers.json');
  if (!fs.existsSync(dataPath)) {
    console.error('demoRetailers.json not found:', dataPath);
    process.exit(1);
  }

  const demo = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const addresses = (demo.retailers || []).map(r => r.address);
  if (addresses.length === 0) {
    console.log('No demo retailers found in demoRetailers.json');
    return;
  }

  const retailContractAddress = process.env.RETAILER_REGISTRY_ADDRESS || (process.env.REACT_APP_RETAILER_REGISTRY_ADDRESS);
  if (!retailContractAddress) {
    console.log('Retailer registry address not provided via env. Falling back to .env in frontend.');
    // try to read frontend .env
    const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env');
    if (fs.existsSync(frontendEnvPath)) {
      const env = fs.readFileSync(frontendEnvPath, 'utf8');
      const match = env.match(/REACT_APP_RETAILER_REGISTRY_ADDRESS=(.*)/);
      if (match) retailContractAddress = match[1].trim();
    }
  }

  if (!retailContractAddress) {
    console.error('Could not determine RetailerRegistry address. Set RETAILER_REGISTRY_ADDRESS env or ensure frontend/.env exists.');
    process.exit(1);
  }

  // Use Hardhat's provider and contract helpers to avoid ABI/ethers-version issues
  console.log('Using RetailerRegistry address:', retailContractAddress);
  const provider = ethers.provider || new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
  const code = await provider.getCode(retailContractAddress);
  console.log('Contract bytecode length:', code ? code.length : 0);

  // Prefer getContractAt which uses the project's compiled artifacts
  let registry;
  try {
    registry = await ethers.getContractAt('RetailerRegistry', retailContractAddress);
  } catch (err) {
    // Fallback: try constructing with frontend ABI
    const artifactPath = path.join(__dirname, '..', 'frontend', 'src', 'contracts', 'RetailerRegistry.json');
    if (!fs.existsSync(artifactPath)) {
      console.error('RetailerRegistry ABI not found at', artifactPath);
      process.exit(1);
    }
    const abi = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    registry = new ethers.Contract(retailContractAddress, abi, provider);
  }

  for (const addr of addresses) {
    try {
      const r = await registry.retailers(addr);
      console.log('Retailer:', addr, {
        name: r.name,
        isAuthorized: r.isAuthorized,
        reputationScore: r.reputationScore.toString(),
        totalProductsHandled: r.totalProductsHandled.toString()
      });
    } catch (err) {
      console.error('Error reading retailer', addr, err?.message || err);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
