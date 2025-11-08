const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n[SETUP] Register demo retailers on-chain\n');

  const signers = await hre.ethers.getSigners();
  const admin = signers[0];

  const envPath = path.join(__dirname, '..', 'frontend', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const rrAddress = envContent.match(/REACT_APP_RETAILER_REGISTRY_ADDRESS=(.+)/)?.[1]?.trim();
  if (!rrAddress) {
    console.error('[ERROR] REACT_APP_RETAILER_REGISTRY_ADDRESS not found in frontend/.env');
    process.exit(1);
  }

  const demoPath = path.join(__dirname, '..', 'frontend', 'src', 'data', 'demoRetailers.json');
  const demo = JSON.parse(fs.readFileSync(demoPath, 'utf8'));
  const entries = demo.retailers || [];

  const RetailerRegistry = await hre.ethers.getContractFactory('RetailerRegistry');
  const rr = RetailerRegistry.attach(rrAddress);

  // Check admin role exists and grant if necessary 
  try {
    const BRAND_ROLE = await rr.BRAND_MANAGER_ROLE();
    const hasBrand = await rr.hasRole(BRAND_ROLE, admin.address);
    if (!hasBrand) {
      console.log('   [INFO] Admin missing BRAND_MANAGER_ROLE, attempting to grant it to admin (if deployer)');
      try {
        await (await rr.connect(admin).grantRole(BRAND_ROLE, admin.address)).wait();
        console.log('   [INFO] Granted BRAND_MANAGER_ROLE to admin');
      } catch (gErr) {
        console.warn('   [WARN] Could not grant BRAND_MANAGER_ROLE to admin:', gErr.message || gErr);
      }
    }
  } catch (e) {
    // ignore
  }

  for (const entry of entries) {
    try {
      const existing = await rr.retailers(entry.address);
      if (existing && existing.isAuthorized) {
        console.log(`   [SKIP] ${entry.address} already registered`);
        continue;
      }
    } catch (_) {
      // If reading mapping fails, continue to attempt registration
    }

    try {
      console.log(`   [REGISTER] ${entry.address} -> ${entry.name}`);
      const tx = await rr.connect(admin).registerRetailer(entry.address, entry.name);
      await tx.wait();
      console.log('      -> registered');
    } catch (err) {
      console.error('      [ERROR] could not register:', err.message || err);
    }
  }

  console.log('\n[SETUP] Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
