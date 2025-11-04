const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

async function main() {
  const envPath = path.join(__dirname, '..', 'frontend', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('frontend/.env not found');
    process.exit(1);
  }

  const env = fs.readFileSync(envPath, 'utf8');
  const match = (k) => env.match(new RegExp(`${k}=(.+)`))?.[1]?.trim();

  const rpc = match('REACT_APP_RPC_URL') || 'http://127.0.0.1:8545';
  const pr = match('REACT_APP_PRODUCT_REGISTRY_ADDRESS');
  const vm = match('REACT_APP_VERIFICATION_MANAGER_ADDRESS');

  console.log('RPC URL:', rpc);
  console.log('ProductRegistry:', pr);
  console.log('VerificationManager:', vm);

  const provider = new ethers.JsonRpcProvider(rpc);

  try {
    const block = await provider.getBlockNumber();
    console.log('Block number:', block.toString());
  } catch (e) {
    console.error('Could not connect to RPC. Is Hardhat node running?');
    console.error(e.message || e);
    process.exit(1);
  }

  async function checkCode(addr, name) {
    if (!addr) {
      console.log(`${name} address not set in frontend/.env`);
      return;
    }
    try {
      const code = await provider.getCode(addr);
      if (!code || code === '0x') {
        console.log(`${name} code: NONE (0x)`);
      } else {
        console.log(`${name} code size: ${code.length / 2 - 1} bytes`);
      }
    } catch (e) {
      console.log(`${name} getCode failed:`, e.message || e);
    }
  }

  await checkCode(pr, 'ProductRegistry');
  await checkCode(vm, 'VerificationManager');
}

main().catch((e) => { console.error(e); process.exit(1); });
