const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

function readEnv(envPath) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const m = line.match(/^\s*([^#][A-Za-z0-9_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

async function main() {
  const demoAddr = '0x2546BcD3c84621e976D8185a91A922aE77ECEc30'; // Demo Retailer 1
  const envPath = path.resolve(__dirname, '../frontend/.env');
  if (!fs.existsSync(envPath)) {
    console.error('frontend/.env not found');
    process.exit(1);
  }
  const env = readEnv(envPath);
  const registryAddr = env.REACT_APP_RETAILER_REGISTRY_ADDRESS;
  const rpc = env.REACT_APP_RPC_URL || 'http://127.0.0.1:8545';

  if (!registryAddr) {
    console.error('REACT_APP_RETAILER_REGISTRY_ADDRESS not set in frontend/.env');
    process.exit(1);
  }

  const abiPath = path.resolve(__dirname, '../frontend/src/contracts/RetailerRegistry.json');
  if (!fs.existsSync(abiPath)) {
    console.error('ABI file not found at', abiPath);
    process.exit(1);
  }
  const artifact = require(abiPath);
  const provider = new ethers.JsonRpcProvider(rpc);
  const registry = new ethers.Contract(registryAddr, artifact.abi, provider);

  console.log('Querying RetailerRegistry at', registryAddr, 'for', demoAddr, 'via', rpc);

  try {
    const r = await registry.retailers(demoAddr);
    console.log('retailer struct:', {
      isAuthorized: r.isAuthorized,
      name: r.name,
      reputationScore: r.reputationScore?.toString ? r.reputationScore.toString() : r.reputationScore,
      totalVerifications: r.totalVerifications?.toString ? r.totalVerifications.toString() : r.totalVerifications,
      failedVerifications: r.failedVerifications?.toString ? r.failedVerifications.toString() : r.failedVerifications,
      totalProductsHandled: r.totalProductsHandled?.toString ? r.totalProductsHandled.toString() : r.totalProductsHandled,
      registeredAt: r.registeredAt?.toString ? r.registeredAt.toString() : r.registeredAt,
    });
  } catch (e) {
    console.error('Error reading retailer struct:', e.message || e);
  }

  try {
    const breakdown = await registry.getReputationBreakdown(demoAddr);
    console.log('breakdown raw:', breakdown.map((v) => (v?.toString ? v.toString() : v)));
  } catch (e) {
    console.error('Error calling getReputationBreakdown:', e.message || e);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
