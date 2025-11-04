const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const envPath = path.join(__dirname, '..', 'frontend', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('[ERROR] frontend/.env not found');
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  const vmAddress = envContent
    .match(/REACT_APP_VERIFICATION_MANAGER_ADDRESS=(.+)/)?.[1]
    ?.trim();

  if (!vmAddress) {
    console.error('[ERROR] VERIFICATION_MANAGER address not found in frontend/.env');
    process.exit(1);
  }

  const VerificationManager = await hre.ethers.getContractFactory('VerificationManager');
  const vm = VerificationManager.attach(vmAddress);

  const filter = vm.filters.VerificationRequested();
  const events = await vm.queryFilter(filter, 0, 'latest');

  if (!events || events.length === 0) {
    console.log('[INFO] No VerificationRequested events found');
    return;
  }

  console.log(`[INFO] Found ${events.length} verification request(s)`);
  for (const e of events) {
    const args = e.args;
    const createdAt = args.createdAt ? new Date(args.createdAt.toNumber() * 1000).toISOString() : 'n/a';
    console.log('---');
    console.log('requestId:', args.requestId.toString());
    console.log('productId:', args.productId.toString());
    console.log('requester:', args.requester);
    console.log('createdAt:', createdAt);
    console.log('txHash:', e.transactionHash);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
