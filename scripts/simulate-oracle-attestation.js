const { ethers } = require("hardhat");

async function main() {
  const oracleAddress = process.env.ORACLE_INTEGRATION || process.env.REACT_APP_ORACLE_INTEGRATION_ADDRESS || "0x0165878A594ca255338adfa4d48449f69242Eb8F";
  const requestId = process.argv[2] || process.env.REQUEST_ID;
  const productId = process.argv[3] || process.env.PRODUCT_ID;
  const verdictArg = process.argv[4] || "true";
  const evidenceURI = process.argv[5] || "ipfs://example-evidence";
  const signerLike = process.argv[6] || process.env.SIGNER_LIKE || (await (await ethers.getSigners())[0]).address; // the registered source address
  const weight = parseInt(process.argv[7] || "100", 10);
  const sourceType = process.argv[8] || "Human"; // Human or IoT
  const readingCode = parseInt(process.argv[9] || process.env.READING_CODE || "0", 10);
  const readingValue = parseInt(process.argv[10] || process.env.READING_VALUE || "0", 10);
  const gps = process.argv[11] || process.env.GPS; // optional GPS string like '51.5074,-0.1278'
  const attestationTimestampArg = process.argv[12] || process.env.ATTESTATION_TIMESTAMP; // seconds or ms
  const attestationDeadlineArg = process.argv[13] || process.env.ATTESTATION_DEADLINE; // seconds or ms
  const attestationNonceArg = process.argv[14] || process.env.ATTESTATION_NONCE; // optional nonce override for trusted submission

  if (!requestId || !productId) {
    console.error("Usage: node scripts/simulate-oracle-attestation.js <requestId> <productId> [verdict:true|false] [evidenceURI] [signerLike] [weight] [sourceType] [readingCode] [readingValue] [gps] [timestamp] [deadline] [nonce]");
    process.exit(1);
  }

  // Use a JsonRpcProvider for ENS/name resolution and to avoid
  // the HardhatEthersProvider.resolveName unsupported method when
  // the hardhat runtime provider is used indirectly.
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  const rpcProvider = new ethers.JsonRpcProvider(rpcUrl);
  const signers = await ethers.getSigners();
  const admin = signers[0];

  // Ensure the Hardhat provider supports resolveName by delegating to the
  // standard JsonRpcProvider when necessary. This avoids the
  // "HardhatEthersProvider.resolveName is not implemented" /
  // "contract runner does not support calling" errors when Ethers
  // attempts ENS/name resolution.
  const hhProvider = ethers.provider;
  if (typeof hhProvider.resolveName !== 'function') {
    hhProvider.resolveName = rpcProvider.resolveName.bind(rpcProvider);
  }

  // Also ensure the Hardhat provider has safe ENS stubs to avoid
  // calls to getEnsAddress/resolveName that throw on local networks.
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

  // Some JSON-RPC nodes (local hardhat) do not support ENS. Ethers may
  // call `getEnsAddress` which throws UNSUPPORTED_OPERATION; to avoid that
  // we monkeypatch the provider to return null for ENS resolution and
  // provide a safe resolveName that simply normalizes hex addresses.
  if (typeof rpcProvider.getEnsAddress !== 'function') {
    rpcProvider.getEnsAddress = async () => null;
  }
  // Safe resolveName: if input is already an address return checksum, else null
  rpcProvider.resolveName = rpcProvider.resolveName || (async (name) => {
    if (typeof name === 'string' && name.match(/^0x[0-9a-fA-F]{40}$/)) {
      return ethers.getAddress(name);
    }
    return null;
  });

  console.log("OracleIntegration address:", oracleAddress);
  const Oracle = await ethers.getContractFactory("OracleIntegration");
  // Use the JsonRpcProvider's signer so the contract runner supports resolveName
  // and normal JSON-RPC calls. rpcProvider.getSigner(admin.address) works when
  // the node (e.g. `npx hardhat node`) exposes unlocked accounts.
  // Create two contract views: one backed by the rpcProvider for read-only
  // calls (supports .call/resolveName), and another connected to the Hardhat
  // runtime signer (admin) for sending transactions. Using the Hardhat
  // signer for txs keeps behaviour consistent when running via
  // `npx hardhat run --network localhost`.
  const rpcSigner = rpcProvider.getSigner(admin.address);
  // Prefer an explicit PRIVATE_KEY-based wallet signer if provided. This
  // guarantees we have a signer that can send transactions via rpcProvider
  // and avoids relying on Hardhat's in-process runner which has partial
  // implementations (resolveName/sendTransaction) in some contexts.
  const txSigner = process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY, rpcProvider) : rpcProvider.getSigner(admin.address);

  const oracleRead = new ethers.Contract(oracleAddress, Oracle.interface, rpcProvider);
  const oracleTx = Oracle.attach(oracleAddress).connect(txSigner);

  // Diagnostic info: print provider/signer capabilities to help debug
  try {
    console.log('rpcProvider.call:', typeof rpcProvider.call);
    console.log('rpcSigner.call:', typeof rpcSigner.call);
    console.log('rpcProvider.resolveName:', typeof rpcProvider.resolveName);
  console.log('rpcProvider.listAccounts (first 10):', (await rpcProvider.listAccounts()).slice(0,10));
  console.log('admin.address:', admin.address);
  console.log('PRIVATE_KEY provided:', typeof process.env.PRIVATE_KEY === 'string' && process.env.PRIVATE_KEY.length > 0);
  } catch (dErr) {
    console.warn('Diagnostic probe failed:', dErr && dErr.message ? dErr.message : dErr);
  }

  let normalizedSignerLike = signerLike;
  try {
    normalizedSignerLike = ethers.getAddress(signerLike);
  } catch (e) {
    if (typeof signerLike === 'string' && signerLike.match(/^0x[0-9a-fA-F]{64}$/)) {
      console.error("SIGNER_LIKE looks like a 32-byte hex value (bytes32). OracleIntegration expects an address (20-byte, 0x + 40 hex).\nPlease pass the registered source address (for example: 0x90F79bf6EB2c4f870365E785982E1f101E93b906). Aborting.");
    } else {
      console.error("SIGNER_LIKE is not a valid Ethereum address. Provide a checksummed address (0x...) or an ENS name resolvable by your node. Aborting.");
    }
    process.exit(1);
  }

  // Get SUBMITTER_ROLE and ORACLE_ADMIN_ROLE values
  const SUBMITTER_ROLE = await oracleRead.SUBMITTER_ROLE();
  const ORACLE_ADMIN_ROLE = await oracleRead.ORACLE_ADMIN_ROLE();
  console.log("SUBMITTER_ROLE:", SUBMITTER_ROLE);
  console.log("ORACLE_ADMIN_ROLE:", ORACLE_ADMIN_ROLE);

  // Ensure signerLike is registered as a source
  try {
    // registerSource requires ORACLE_ADMIN_ROLE so use admin
    const src = await oracleRead.sources(normalizedSignerLike);
    if (!src.active) {
      console.log(`Registering source ${normalizedSignerLike} with weight ${weight}`);
        const sType = sourceType.toLowerCase().startsWith("i") ? 0 : 1; // 0 = IoT, 1 = Human
        try {
          const txNonce = await rpcProvider.getTransactionCount(await txSigner.getAddress());
          const txReg = await oracleTx.registerSource(normalizedSignerLike, sType, weight, { nonce: txNonce });
          await txReg.wait();
        } catch (txErr) {
          // Fall back to the simpler path if overriding nonce fails
          const txReg = await oracleTx.registerSource(normalizedSignerLike, sType, weight);
          await txReg.wait();
        }
      console.log("Source registered");
    } else {
      console.log(`Source ${normalizedSignerLike} already registered (active=${src.active}, weight=${src.weight})`);
    }
  } catch (err) {
    console.warn("Could not read/register source (maybe already registered or ABI mismatch):", err.message || err);
  }

  // Grant SUBMITTER_ROLE to admin (if not already)
  try {
    const hasRole = await oracleRead.hasRole(SUBMITTER_ROLE, admin.address);
    if (!hasRole) {
      console.log("Granting SUBMITTER_ROLE to admin (to allow trusted submissions)");
      try {
        const txNonce = await rpcProvider.getTransactionCount(await txSigner.getAddress());
        const tx = await oracleTx.grantRole(SUBMITTER_ROLE, admin.address, { nonce: txNonce });
        await tx.wait();
      } catch (txErr) {
        const tx = await oracleTx.grantRole(SUBMITTER_ROLE, admin.address);
        await tx.wait();
      }
      console.log("Granted SUBMITTER_ROLE to admin");
    } else {
      console.log("Admin already has SUBMITTER_ROLE");
    }
  } catch (err) {
    console.warn("Could not grant SUBMITTER_ROLE:", err.message || err);
  }

  // Build Attestation struct
  const verdict = (verdictArg === "true" || verdictArg === "1");
  // normalize timestamp/deadline inputs (support ms and seconds)
  const nowSec = Math.floor(Date.now() / 1000);
  let attestationTimestamp = attestationTimestampArg ? parseInt(attestationTimestampArg, 10) : undefined;
  if (attestationTimestamp && attestationTimestamp > 1e12) attestationTimestamp = Math.floor(attestationTimestamp / 1000);
  let attestationDeadline = attestationDeadlineArg ? parseInt(attestationDeadlineArg, 10) : undefined;
  if (attestationDeadline && attestationDeadline > 1e12) attestationDeadline = Math.floor(attestationDeadline / 1000);
  const attestationNonce = attestationNonceArg ? parseInt(attestationNonceArg, 10) : 0;

  // If GPS provided, optionally include it in evidenceURI when a structured IPFS link isn't used
  let finalEvidenceURI = evidenceURI;
  if (gps) {
    // append human-readable GPS fragment
    if (!evidenceURI || evidenceURI === "ipfs://example-evidence") {
      finalEvidenceURI = `gps:${gps}`;
    } else {
      finalEvidenceURI = `${evidenceURI} | gps:${gps}`;
    }
  }

  const a = {
    requestId: requestId,
    productId: productId,
    verdict: verdict,
    evidenceURI: finalEvidenceURI,
    readingCode: readingCode,
    readingValue: readingValue,
    timestamp: attestationTimestamp || nowSec,
    deadline: attestationDeadline || (nowSec + 3600),
    nonce: attestationNonce
  };

  // Submit trusted attestation (requires SUBMITTER_ROLE on caller)
  try {
    // Check whether this source has already attested for this request to avoid a revert
    const alreadyAttested = await oracleRead.hasSourceAttested(requestId, normalizedSignerLike);
    if (alreadyAttested) {
      console.error(`Source ${normalizedSignerLike} has ALREADY attested to request ${requestId}. Submitting would revert with "Duplicate from source".\nOptions: use a different SIGNER_LIKE, use a different REQUEST_ID, or reset your local chain state.`);
      process.exit(1);
    }

    console.log("Submitting trusted attestation as admin (submitAttestationTrusted)...");
    try {
      const txNonce = await rpcProvider.getTransactionCount(await txSigner.getAddress());
      const tx = await oracleTx.submitAttestationTrusted(a, normalizedSignerLike, { nonce: txNonce });
      const receipt = await tx.wait();
      console.log("Submitted trusted attestation, tx:", tx.hash, "status:", receipt.status);
    } catch (txErr) {
      // Try without explicit nonce if the override fails
      try {
        const tx = await oracleTx.submitAttestationTrusted(a, normalizedSignerLike);
        const receipt = await tx.wait();
        console.log("Submitted trusted attestation, tx:", tx.hash, "status:", receipt.status);
      } catch (err) {
        console.error("submitAttestationTrusted failed:", err.message || err);
      }
    }
  } catch (err) {
    console.error("submitAttestationTrusted failed:", err.message || err);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
