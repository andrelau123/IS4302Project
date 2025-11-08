const { ethers } = require("hardhat");

async function main() {
  const oracleAddress = process.env.ORACLE_INTEGRATION || process.env.REACT_APP_ORACLE_INTEGRATION_ADDRESS || "0x0165878A594ca255338adfa4d48449f69242Eb8F";
  const requestId = process.env.REQUEST_ID;
  const productId = process.env.PRODUCT_ID;
  const sourceAddrsRaw = process.env.SOURCE_ADDRESSES; // comma-separated addresses (optional)
  const sourceVerdictsRaw = process.env.SOURCE_VERDICTS; // comma-separated 'true'/'false' matching addresses (optional)
  const weight = parseInt(process.env.SOURCE_WEIGHT || "100", 10);
  const sourceType = process.env.SOURCE_TYPE || "Human"; // Human or IoT
  const readingCode = parseInt(process.env.READING_CODE || "0", 10);
  const readingValue = parseInt(process.env.READING_VALUE || "0", 10);
  const evidenceURI = process.env.EVIDENCE_URI || "ipfs://example-evidence";
  const gps = process.env.GPS; // optional

  if (!requestId || !productId) {
    console.error("Usage: set REQUEST_ID and PRODUCT_ID env vars (and optionally SOURCE_ADDRESSES or run with unlocked accounts)");
    process.exit(1);
  }

  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  const rpcProvider = new ethers.JsonRpcProvider(rpcUrl);
  const signers = await ethers.getSigners();
  const admin = signers[0];

  const hhProvider = ethers.provider;
  if (typeof hhProvider.resolveName !== 'function') {
    hhProvider.resolveName = rpcProvider.resolveName.bind(rpcProvider);
  }
  if (typeof hhProvider.getEnsAddress !== 'function') {
    hhProvider.getEnsAddress = async () => null;
  }
  if (typeof hhProvider.resolveName !== 'function') {
    hhProvider.resolveName = async (name) => {
      if (typeof name === 'string' && name.match(/^0x[0-9a-fA-F]{40}$/)) {
        return ethers.getAddress(name);
      }
      return null;
    };
  }
  if (typeof rpcProvider.getEnsAddress !== 'function') {
    rpcProvider.getEnsAddress = async () => null;
  }
  rpcProvider.resolveName = rpcProvider.resolveName || (async (name) => {
    if (typeof name === 'string' && name.match(/^0x[0-9a-fA-F]{40}$/)) {
      return ethers.getAddress(name);
    }
    return null;
  });

  const Oracle = await ethers.getContractFactory("OracleIntegration");
  const rpcSigner = rpcProvider.getSigner(admin.address);
  const txSigner = process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY, rpcProvider) : rpcProvider.getSigner(admin.address);
  const oracleRead = new ethers.Contract(oracleAddress, Oracle.interface, rpcProvider);
  const oracleTx = Oracle.attach(oracleAddress).connect(txSigner);

  // prepare list of sources
  let sources = [];
  if (sourceAddrsRaw) {
    const arr = sourceAddrsRaw.split(",").map(s => s.trim()).filter(Boolean);
    sources = arr;
  } else {
    // use a few unlocked accounts by default (skip admin at index 0)
    const count = Math.min(3, Math.max(1, (signers.length - 1)));
    for (let i = 1; i <= count; i++) sources.push(signers[i].address);
  }

  let verdicts = [];
  if (sourceVerdictsRaw) {
    verdicts = sourceVerdictsRaw.split(",").map(s => (s.trim() === 'true'));
    // pad if needed
    while (verdicts.length < sources.length) verdicts.push(true);
  } else {
    // default pattern: alternate true/false
    for (let i = 0; i < sources.length; i++) verdicts.push(i % 2 === 0);
  }

  console.log("OracleIntegration:", oracleAddress);
  console.log("RequestId:", requestId);
  console.log("ProductId:", productId);
  console.log("Submitting attestations from sources:", sources);
  console.log("Verdicts:", verdicts);

  // register each source if not active
  try {
    const SUBMITTER_ROLE = await oracleRead.SUBMITTER_ROLE();
    const ORACLE_ADMIN_ROLE = await oracleRead.ORACLE_ADMIN_ROLE();
    // grant SUBMITTER_ROLE to admin if not present
    try {
      const hasRole = await oracleRead.hasRole(SUBMITTER_ROLE, admin.address);
      if (!hasRole) {
        console.log("Granting SUBMITTER_ROLE to admin (for trusted submissions)");
        try {
          const txNonce = await rpcProvider.getTransactionCount(await txSigner.getAddress());
          const tx = await oracleTx.grantRole(SUBMITTER_ROLE, admin.address, { nonce: txNonce });
          await tx.wait();
        } catch (e) {
          const tx = await oracleTx.grantRole(SUBMITTER_ROLE, admin.address);
          await tx.wait();
        }
      }
    } catch (e) {
      console.warn('Could not check/grant SUBMITTER_ROLE:', e && e.message ? e.message : e);
    }

    for (const s of sources) {
      try {
        const src = await oracleRead.sources(s);
        if (!src.active) {
          console.log(`Registering source ${s} with weight ${weight}`);
          const sType = sourceType.toLowerCase().startsWith("i") ? 0 : 1;
          try {
            const txNonce = await rpcProvider.getTransactionCount(await txSigner.getAddress());
            const txReg = await oracleTx.registerSource(s, sType, weight, { nonce: txNonce });
            await txReg.wait();
          } catch (txErr) {
            const txReg = await oracleTx.registerSource(s, sType, weight);
            await txReg.wait();
          }
          console.log("Source registered", s);
        } else {
          console.log(`Source ${s} already registered (active=${src.active}, weight=${src.weight})`);
        }
      } catch (err) {
        console.warn(`Could not read/register source ${s}:`, err && err.message ? err.message : err);
      }
    }
  } catch (err) {
    console.warn('Register stage failed:', err && err.message ? err.message : err);
  }

  // Submit attestations
  const nowSec = Math.floor(Date.now() / 1000);
  const attestationDeadline = nowSec + 3600;
  for (let i = 0; i < sources.length; i++) {
    const signerLike = sources[i];
    const verdict = verdicts[i];
    const finalEvidenceURI = gps ? `${evidenceURI} | gps:${gps}` : evidenceURI;

    const a = {
      requestId: requestId,
      productId: productId,
      verdict: verdict,
      evidenceURI: finalEvidenceURI,
      readingCode: readingCode,
      readingValue: readingValue,
      timestamp: nowSec,
      deadline: attestationDeadline,
      nonce: 0
    };

    try {
      const alreadyAttested = await oracleRead.hasSourceAttested(requestId, signerLike);
      if (alreadyAttested) {
        console.warn(`Source ${signerLike} has already attested for ${requestId}, skipping`);
        continue;
      }

      console.log(`Submitting trusted attestation for source ${signerLike} verdict=${verdict}`);
      try {
        const txNonce = await rpcProvider.getTransactionCount(await txSigner.getAddress());
        const tx = await oracleTx.submitAttestationTrusted(a, signerLike, { nonce: txNonce });
        const receipt = await tx.wait();
        console.log(`Submitted trusted attestation, tx: ${tx.hash} status: ${receipt.status}`);
      } catch (txErr) {
        const tx = await oracleTx.submitAttestationTrusted(a, signerLike);
        const receipt = await tx.wait();
        console.log(`Submitted trusted attestation, tx: ${tx.hash} status: ${receipt.status}`);
      }
    } catch (err) {
      console.error(`Failed to submit attestation for ${signerLike}:`, err && err.message ? err.message : err);
    }
  }

  // Wait a moment for the node to process
  await new Promise(res => setTimeout(res, 500));

  // Read aggregate
  try {
    const agg = await oracleRead.getAggregate(requestId);
    console.log('Aggregate for', requestId, ':');
    console.log('  quorumReached:', agg[0]);
    console.log('  passed:', agg[1]);
    console.log('  totalWeight:', agg[2].toString());
    console.log('  passWeight:', agg[3].toString());
    console.log('  count:', agg[4].toString());
  } catch (e) {
    console.error('Failed to read aggregate:', e && e.message ? e.message : e);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
