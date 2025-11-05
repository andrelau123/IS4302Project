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

// List of contracts and the role constants we'd like to inspect
const CONTRACT_ROLES = {
  ProductRegistry: ['MANUFACTURER_ROLE', 'VERIFIER_ROLE', 'REGISTRY_ADMIN_ROLE'],
  ProductNFT: ['MINTER_ROLE', 'TRANSFER_VALIDATOR_ROLE'],
  VerificationManager: ['VERIFIER_ROLE', 'SLASHER_ROLE'],
  OracleIntegration: ['ORACLE_ADMIN_ROLE', 'SUBMITTER_ROLE'],
  FeeDistributor: ['DISTRIBUTOR_ROLE'],
  DisputeResolution: ['VERIFIER_ROLE'],
  GovernanceVoting: ['PROPOSER_ROLE'],
  RetailerRegistry: ['BRAND_MANAGER_ROLE', 'PRODUCT_REGISTRY_ROLE', 'VERIFICATION_MANAGER_ROLE'],
  AuthToken: ['MINTER_ROLE'],
};

async function loadAbi(projectRoot, name) {
  const p = path.join(projectRoot, 'frontend', 'src', 'contracts', `${name}.json`);
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  return raw.abi || raw;
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

  // map contract key -> env var names used in frontend
  const addressMap = {
    ProductRegistry: env.REACT_APP_PRODUCT_REGISTRY_ADDRESS,
    ProductNFT: env.REACT_APP_PRODUCT_NFT_ADDRESS,
    VerificationManager: env.REACT_APP_VERIFICATION_MANAGER_ADDRESS,
    OracleIntegration: env.REACT_APP_ORACLE_INTEGRATION_ADDRESS,
    FeeDistributor: env.REACT_APP_FEE_DISTRIBUTOR_ADDRESS,
    DisputeResolution: env.REACT_APP_DISPUTE_RESOLUTION_ADDRESS,
    GovernanceVoting: env.REACT_APP_GOVERNANCE_VOTING_ADDRESS,
    RetailerRegistry: env.REACT_APP_RETAILER_REGISTRY_ADDRESS,
    AuthToken: env.REACT_APP_AUTH_TOKEN_ADDRESS,
  };

  for (const [contractName, roleList] of Object.entries(CONTRACT_ROLES)) {
    const addr = addressMap[contractName];
    if (!addr) {
      console.log(`\nSkipping ${contractName}: no address in frontend/.env`);
      continue;
    }

    const abi = await loadAbi(repoRoot, contractName);
    if (!abi) {
      console.log(`\nSkipping ${contractName}: ABI not found in frontend/src/contracts/${contractName}.json`);
      continue;
    }

    const c = new ethers.Contract(addr, abi, provider);
    console.log(`\n--- ${contractName} @ ${addr} ---`);

    for (const roleName of roleList) {
      try {
        const role = await c[roleName]();
        console.log(`${roleName}: ${role}`);

        // Query past RoleGranted events for this role (AccessControl's RoleGranted role, account, sender)
        let addrs = new Set();
        try {
          const filter = c.filters.RoleGranted(role, null, null);
          const events = await c.queryFilter(filter);
          for (const ev of events) {
            addrs.add(ev.args.account);
          }
        } catch (evErr) {
          // ignore if event not present
        }

        if (addrs.size === 0) {
          console.log(`  No RoleGranted events found for ${roleName}`);
        } else {
          console.log(`  Addresses granted ${roleName}:`);
          for (const a of addrs) {
            const has = await c.hasRole(role, a);
            console.log(`   - ${a}  (hasRole: ${has})`);
          }
        }
      } catch (err) {
        console.log(`  Could not read role ${roleName} on ${contractName}:`, err.message || err);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
