const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

function parseEnv(envPath) {
  const txt = fs.readFileSync(envPath, 'utf8');
  const lines = txt.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    out[k] = v;
  }
  return out;
}

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const envPath = path.join(repoRoot, 'frontend', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('frontend/.env not found');
    process.exit(1);
  }

  const env = parseEnv(envPath);
  const rpc = env.REACT_APP_RPC_URL || 'http://127.0.0.1:8545';
  const provider = new ethers.JsonRpcProvider(rpc);

  const productRegistryAddress = env.REACT_APP_PRODUCT_REGISTRY_ADDRESS;
  if (!productRegistryAddress) {
    console.error('ProductRegistry address not found in frontend/.env');
    process.exit(1);
  }

  const abiPath = path.join(repoRoot, 'frontend', 'src', 'contracts', 'ProductRegistry.json');
  if (!fs.existsSync(abiPath)) {
    console.error('ABI not found at', abiPath);
    process.exit(1);
  }

  const abiJson = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const contract = new ethers.Contract(productRegistryAddress, abiJson.abi || abiJson, provider);

  // get role identifier
  const MANUFACTURER_ROLE = await contract.MANUFACTURER_ROLE();
  console.log('MANUFACTURER_ROLE bytes32:', MANUFACTURER_ROLE);

  // Use contract filter for RoleGranted events
  const filter = contract.filters.RoleGranted(MANUFACTURER_ROLE, null, null);
  const events = await contract.queryFilter(filter);

  const addrs = new Set();
  for (const ev of events) {
    // RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
    const account = ev.args.account;
    addrs.add(account);
  }

  if (addrs.size === 0) {
    console.log('No RoleGranted events found for MANUFACTURER_ROLE in logs. It might have been granted before the current archive window or via direct grant without event (unlikely).');
  } else {
    console.log('\nAddresses granted MANUFACTURER_ROLE (from logs):');
    for (const a of addrs) console.log('-', a);
  }

  // Also show current hasRole for those addresses (if any were found)
  for (const a of addrs) {
    const has = await contract.hasRole(MANUFACTURER_ROLE, a);
    console.log(`hasRole(${a}):`, has);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
