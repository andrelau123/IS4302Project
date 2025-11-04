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

  const registryAddr = env.REACT_APP_RETAILER_REGISTRY_ADDRESS;
  if (!registryAddr) {
    console.error('REACT_APP_RETAILER_REGISTRY_ADDRESS not set in frontend/.env');
    process.exit(1);
  }

  const abiPath = path.join(repoRoot, 'frontend', 'src', 'contracts', 'RetailerRegistry.json');
  if (!fs.existsSync(abiPath)) {
    console.error('ABI not found:', abiPath);
    process.exit(1);
  }

  const abiJson = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const registry = new ethers.Contract(registryAddr, abiJson.abi || abiJson, provider);

  console.log('RetailerRegistry @', registryAddr);

  // Get RetailerRegistered events
  try {
    const regFilter = registry.filters.RetailerRegistered(null, null);
    const regEvents = await registry.queryFilter(regFilter);
    const retailers = [];
    for (const ev of regEvents) {
      const addr = ev.args.retailer;
      const name = ev.args.name;
      retailers.push({ addr, name });
    }

    if (retailers.length === 0) {
      console.log('No RetailerRegistered events found.');
    } else {
      console.log('\nRegistered retailers (from events):');
      for (const r of retailers) {
        console.log('-', r.addr, 'name:', r.name);
      }
    }

    // Get RetailerAuthorized events
    const authFilter = registry.filters.RetailerAuthorized(null, null);
    const authEvents = await registry.queryFilter(authFilter);
    if (authEvents.length === 0) {
      console.log('\nNo RetailerAuthorized events found.');
    } else {
      console.log('\nRetailerAuthorizations (brand -> retailer):');
      for (const ev of authEvents) {
        console.log('-', ev.args.brand, 'authorized', ev.args.retailer);
      }
    }

    // For each retailer found, read its full record via retailers(address)
    if (retailers.length > 0) {
      console.log('\nRetailer details from contract mapping:');
      for (const r of retailers) {
        try {
          const rec = await registry.retailers(r.addr);
          console.log(`- ${r.addr} name=${r.name} isAuthorized=${rec.isAuthorized} reputation=${rec.reputationScore} registeredAt=${new Date(Number(rec.registeredAt)*1000).toISOString()}`);
        } catch (e) {
          console.log('- could not read mapping for', r.addr, e.message || e);
        }
      }
    }
  } catch (err) {
    console.error('Error querying retailer registry events:', err);
    process.exitCode = 1;
  }
}

main().catch((e)=>{console.error(e); process.exitCode=1});
