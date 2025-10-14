const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("OracleIntegration", function () {
  let oracleIntegration;
  let owner, oracleSource1, oracleSource2, humanSource1, submitter;
  let ORACLE_ADMIN_ROLE, SUBMITTER_ROLE;

  // EIP-712 domain and type data
  let domain;
  let types;

  beforeEach(async function () {
    [owner, oracleSource1, oracleSource2, humanSource1, submitter] = await ethers.getSigners();
    
    const OracleIntegration = await ethers.getContractFactory("OracleIntegration");
    oracleIntegration = await OracleIntegration.deploy(owner.address);
    
    ORACLE_ADMIN_ROLE = await oracleIntegration.ORACLE_ADMIN_ROLE();
    SUBMITTER_ROLE = await oracleIntegration.SUBMITTER_ROLE();
    
    // Set up EIP-712 domain
    domain = {
      name: "OracleIntegration",
      version: "1",
      chainId: 31337, // Hardhat default chain ID
      verifyingContract: oracleIntegration.target
    };
    
    // Set up EIP-712 types
    types = {
      Attestation: [
        { name: "requestId", type: "bytes32" },
        { name: "productId", type: "bytes32" },
        { name: "verdict", type: "bool" },
        { name: "evidenceURI", type: "string" },
        { name: "readingCode", type: "uint256" },
        { name: "readingValue", type: "int256" },
        { name: "timestamp", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "nonce", type: "uint256" }
      ]
    };
    
    // Grant submitter role for trusted submission tests
    await oracleIntegration.grantRole(SUBMITTER_ROLE, submitter.address);
  });

  describe("Deployment", function () {
    it("Should grant admin roles to deployer", async function () {
      expect(await oracleIntegration.hasRole(await oracleIntegration.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await oracleIntegration.hasRole(ORACLE_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should set default aggregation parameters", async function () {
      expect(await oracleIntegration.quorumWeight()).to.equal(200);
      expect(await oracleIntegration.passBpsThreshold()).to.equal(6000); // 60%
    });
  });

  describe("Source Management", function () {
    it("Should allow admin to register IoT source", async function () {
      await expect(oracleIntegration.registerSource(oracleSource1.address, 0, 100)) // SourceType.IoT = 0
        .to.emit(oracleIntegration, "SourceRegistered")
        .withArgs(oracleSource1.address, 0, 100);
      
      const source = await oracleIntegration.sources(oracleSource1.address);
      expect(source.active).to.be.true;
      expect(source.sType).to.equal(0); // IoT
      expect(source.weight).to.equal(100);
    });

    it("Should allow admin to register Human source", async function () {
      await expect(oracleIntegration.registerSource(humanSource1.address, 1, 150)) // SourceType.Human = 1
        .to.emit(oracleIntegration, "SourceRegistered")
        .withArgs(humanSource1.address, 1, 150);
      
      const source = await oracleIntegration.sources(humanSource1.address);
      expect(source.active).to.be.true;
      expect(source.sType).to.equal(1); // Human
      expect(source.weight).to.equal(150);
    });

    it("Should not allow zero address registration", async function () {
      await expect(oracleIntegration.registerSource(ethers.ZeroAddress, 0, 100))
        .to.be.revertedWith("Zero address");
    });

    it("Should not allow zero weight registration", async function () {
      await expect(oracleIntegration.registerSource(oracleSource1.address, 0, 0))
        .to.be.revertedWith("Weight=0");
    });

    it("Should not allow non-admin to register source", async function () {
      await expect(oracleIntegration.connect(oracleSource1).registerSource(oracleSource1.address, 0, 100))
        .to.be.reverted;
    });

    it("Should allow admin to update existing source", async function () {
      await oracleIntegration.registerSource(oracleSource1.address, 0, 100);
      
      await expect(oracleIntegration.updateSource(oracleSource1.address, false, 120))
        .to.emit(oracleIntegration, "SourceUpdated")
        .withArgs(oracleSource1.address, false, 120);
      
      const source = await oracleIntegration.sources(oracleSource1.address);
      expect(source.active).to.be.false;
      expect(source.weight).to.equal(120);
    });

    it("Should allow admin to revoke source", async function () {
      await oracleIntegration.registerSource(oracleSource1.address, 0, 100);
      
      await expect(oracleIntegration.revokeSource(oracleSource1.address))
        .to.emit(oracleIntegration, "SourceRevoked")
        .withArgs(oracleSource1.address);
      
      const source = await oracleIntegration.sources(oracleSource1.address);
      expect(source.active).to.be.false;
      expect(source.weight).to.equal(0);
    });
  });

  describe("Aggregation Parameters", function () {
    it("Should allow admin to update quorum weight", async function () {
      const newQuorum = 300;
      const newPassBps = 7000; // 70%
      
      await expect(oracleIntegration.setAggregationParams(newQuorum, newPassBps))
        .to.emit(oracleIntegration, "AggregationParamsUpdated")
        .withArgs(newQuorum, newPassBps);
      
      expect(await oracleIntegration.quorumWeight()).to.equal(newQuorum);
      expect(await oracleIntegration.passBpsThreshold()).to.equal(newPassBps);
    });

    it("Should not allow invalid parameters", async function () {
      await expect(oracleIntegration.setAggregationParams(0, 5000))
        .to.be.revertedWith("Bad quorum");
      
      await expect(oracleIntegration.setAggregationParams(200, 10001))
        .to.be.revertedWith("Bad bps");
    });
  });

  describe("Attestation Submission", function () {
    beforeEach(async function () {
      // Register sources
      await oracleIntegration.registerSource(oracleSource1.address, 0, 100); // IoT, weight 100
      await oracleIntegration.registerSource(oracleSource2.address, 0, 150); // IoT, weight 150
      await oracleIntegration.registerSource(humanSource1.address, 1, 120); // Human, weight 120
    });

    async function createSignedAttestation(signer, attestationData) {
      const signature = await signer.signTypedData(domain, types, attestationData);
      return signature;
    }

    it("Should accept valid signed attestations", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      const productId = ethers.keccak256(ethers.toUtf8Bytes("product1"));
      const deadline = (await time.latest()) + 3600; // 1 hour from now
      const nonce = await oracleIntegration.nonces(oracleSource1.address);
      
      const attestation = {
        requestId: requestId,
        productId: productId,
        verdict: true,
        evidenceURI: "ipfs://QmEvidence1",
        readingCode: 1,
        readingValue: 25,
        timestamp: await time.latest(),
        deadline: deadline,
        nonce: nonce
      };
      
      const signature = await createSignedAttestation(oracleSource1, attestation);
      
      await expect(oracleIntegration.submitAttestation(attestation, signature))
        .to.emit(oracleIntegration, "Attested")
        .withArgs(
          requestId,
          productId,
          oracleSource1.address,
          true,
          100, // weight
          "ipfs://QmEvidence1",
          1,
          25,
          attestation.timestamp
        );
    });

    it("Should reject attestations from unregistered sources", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      const productId = ethers.keccak256(ethers.toUtf8Bytes("product1"));
      const deadline = (await time.latest()) + 3600;
      const nonce = 0; // Unregistered source starts with nonce 0
      
      const attestation = {
        requestId: requestId,
        productId: productId,
        verdict: true,
        evidenceURI: "ipfs://QmEvidence1",
        readingCode: 1,
        readingValue: 25,
        timestamp: await time.latest(),
        deadline: deadline,
        nonce: nonce
      };
      
      // Sign with an unregistered source
      const unregisteredSigner = ethers.Wallet.createRandom();
      const signature = await unregisteredSigner.signTypedData(domain, types, attestation);
      
      await expect(oracleIntegration.submitAttestation(attestation, signature))
        .to.be.revertedWith("Unregistered/Revoked source");
    });

    it("Should reject expired attestations", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      const productId = ethers.keccak256(ethers.toUtf8Bytes("product1"));
      const pastDeadline = (await time.latest()) - 1; // Already expired
      const nonce = await oracleIntegration.nonces(oracleSource1.address);
      
      const attestation = {
        requestId: requestId,
        productId: productId,
        verdict: true,
        evidenceURI: "ipfs://QmEvidence1",
        readingCode: 1,
        readingValue: 25,
        timestamp: await time.latest(),
        deadline: pastDeadline,
        nonce: nonce
      };
      
      const signature = await createSignedAttestation(oracleSource1, attestation);
      
      await expect(oracleIntegration.submitAttestation(attestation, signature))
        .to.be.revertedWith("Signature expired");
    });

    it("Should reject duplicate attestations from same source", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      const productId = ethers.keccak256(ethers.toUtf8Bytes("product1"));
      const deadline = (await time.latest()) + 3600;
      let nonce = await oracleIntegration.nonces(oracleSource1.address);
      
      const attestation1 = {
        requestId: requestId,
        productId: productId,
        verdict: true,
        evidenceURI: "ipfs://QmEvidence1",
        readingCode: 1,
        readingValue: 25,
        timestamp: await time.latest(),
        deadline: deadline,
        nonce: nonce
      };
      
      const signature1 = await createSignedAttestation(oracleSource1, attestation1);
      await oracleIntegration.submitAttestation(attestation1, signature1);
      
      // Try to submit again with incremented nonce
      nonce = await oracleIntegration.nonces(oracleSource1.address);
      const attestation2 = { ...attestation1, nonce: nonce };
      const signature2 = await createSignedAttestation(oracleSource1, attestation2);
      
      await expect(oracleIntegration.submitAttestation(attestation2, signature2))
        .to.be.revertedWith("Duplicate from source");
    });

    it("Should update nonce after successful submission", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      const productId = ethers.keccak256(ethers.toUtf8Bytes("product1"));
      const deadline = (await time.latest()) + 3600;
      
      const initialNonce = await oracleIntegration.nonces(oracleSource1.address);
      
      const attestation = {
        requestId: requestId,
        productId: productId,
        verdict: true,
        evidenceURI: "ipfs://QmEvidence1",
        readingCode: 1,
        readingValue: 25,
        timestamp: await time.latest(),
        deadline: deadline,
        nonce: initialNonce
      };
      
      const signature = await createSignedAttestation(oracleSource1, attestation);
      await oracleIntegration.submitAttestation(attestation, signature);
      
      const finalNonce = await oracleIntegration.nonces(oracleSource1.address);
      expect(finalNonce).to.equal(initialNonce + 1n);
    });
  });

  describe("Trusted Attestation Submission", function () {
    beforeEach(async function () {
      await oracleIntegration.registerSource(oracleSource1.address, 0, 100);
    });

    it("Should allow trusted submitter to submit attestations", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      const productId = ethers.keccak256(ethers.toUtf8Bytes("product1"));
      
      const attestation = {
        requestId: requestId,
        productId: productId,
        verdict: true,
        evidenceURI: "ipfs://QmEvidence1",
        readingCode: 1,
        readingValue: 25,
        timestamp: await time.latest(),
        deadline: (await time.latest()) + 3600,
        nonce: 0 // Not used in trusted submission
      };
      
      await expect(oracleIntegration.connect(submitter).submitAttestationTrusted(attestation, oracleSource1.address))
        .to.emit(oracleIntegration, "Attested");
    });

    it("Should not allow non-submitter to use trusted submission", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      const productId = ethers.keccak256(ethers.toUtf8Bytes("product1"));
      
      const attestation = {
        requestId: requestId,
        productId: productId,
        verdict: true,
        evidenceURI: "ipfs://QmEvidence1",
        readingCode: 1,
        readingValue: 25,
        timestamp: await time.latest(),
        deadline: (await time.latest()) + 3600,
        nonce: 0
      };
      
      await expect(oracleIntegration.connect(oracleSource1).submitAttestationTrusted(attestation, oracleSource1.address))
        .to.be.reverted;
    });
  });

  describe("Aggregation Logic", function () {
    beforeEach(async function () {
      // Register sources with different weights
      await oracleIntegration.registerSource(oracleSource1.address, 0, 100); // IoT, weight 100
      await oracleIntegration.registerSource(oracleSource2.address, 0, 150); // IoT, weight 150
      await oracleIntegration.registerSource(humanSource1.address, 1, 120); // Human, weight 120
    });

    it("Should calculate aggregation correctly with passing verdict", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      
      // Submit passing attestations from two sources (total weight: 250)
      await submitTestAttestation(oracleSource1, requestId, true, 100);
      await submitTestAttestation(oracleSource2, requestId, true, 150);
      
      const [quorumReached, passed, totalWeight, passWeight, count] = await oracleIntegration.getAggregate(requestId);
      
      expect(quorumReached).to.be.true; // 250 >= 200 (quorum)
      expect(passed).to.be.true; // 100% pass rate >= 60%
      expect(totalWeight).to.equal(250);
      expect(passWeight).to.equal(250);
      expect(count).to.equal(2);
    });

    it("Should calculate aggregation correctly with mixed verdicts", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      
      // Submit mixed attestations: pass (100), fail (150), pass (120)
      await submitTestAttestation(oracleSource1, requestId, true, 100);   // Pass
      await submitTestAttestation(oracleSource2, requestId, false, 150);  // Fail  
      await submitTestAttestation(humanSource1, requestId, true, 120);    // Pass
      
      const [quorumReached, passed, totalWeight, passWeight, count] = await oracleIntegration.getAggregate(requestId);
      
      expect(quorumReached).to.be.true; // 370 >= 200
      expect(passed).to.be.false; // (220/370) * 100 = 59.5% < 60%
      expect(totalWeight).to.equal(370);
      expect(passWeight).to.equal(220); // 100 + 120
      expect(count).to.equal(3);
    });

    it("Should not reach quorum with insufficient weight", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      
      // Only submit from one source (weight 100 < quorum 200)
      await submitTestAttestation(oracleSource1, requestId, true, 100);
      
      const [quorumReached, passed, totalWeight, passWeight, count] = await oracleIntegration.getAggregate(requestId);
      
      expect(quorumReached).to.be.false; // 100 < 200
      expect(totalWeight).to.equal(100);
      expect(passWeight).to.equal(100);
      expect(count).to.equal(1);
    });

    it("Should handle edge case with exactly threshold percentage", async function () {
      // Set threshold to exactly 60% for clear testing
      await oracleIntegration.setAggregationParams(200, 6000); // 60%
      
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      
      // Create exact 60% scenario: 150 pass + 100 fail = 60% pass
      await submitTestAttestation(oracleSource2, requestId, true, 150);   // Pass
      await submitTestAttestation(oracleSource1, requestId, false, 100);  // Fail
      
      const [quorumReached, passed, totalWeight, passWeight, count] = await oracleIntegration.getAggregate(requestId);
      
      expect(quorumReached).to.be.true; // 250 >= 200
      expect(passed).to.be.true; // Exactly 60% should pass
      expect(totalWeight).to.equal(250);
      expect(passWeight).to.equal(150);
    });

    async function submitTestAttestation(signer, requestId, verdict, expectedWeight) {
      const productId = ethers.keccak256(ethers.toUtf8Bytes("product1"));
      const deadline = (await time.latest()) + 3600;
      const nonce = await oracleIntegration.nonces(signer.address);
      
      const attestation = {
        requestId: requestId,
        productId: productId,
        verdict: verdict,
        evidenceURI: `ipfs://QmEvidence${Math.random()}`,
        readingCode: 1,
        readingValue: 25,
        timestamp: await time.latest(),
        deadline: deadline,
        nonce: nonce
      };
      
      const signature = await signer.signTypedData(domain, types, attestation);
      await oracleIntegration.submitAttestation(attestation, signature);
    }
  });

  describe("Finalization", function () {
    it("Should allow admin to finalize requests", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      
      await expect(oracleIntegration.finalize(requestId))
        .to.emit(oracleIntegration, "Finalized")
        .withArgs(requestId);
    });

    it("Should not allow non-admin to finalize", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      
      await expect(oracleIntegration.connect(oracleSource1).finalize(requestId))
        .to.be.reverted;
    });
  });

  describe("Query Functions", function () {
    beforeEach(async function () {
      await oracleIntegration.registerSource(oracleSource1.address, 0, 100);
    });

    it("Should track source attestation status correctly", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      
      expect(await oracleIntegration.hasSourceAttested(requestId, oracleSource1.address)).to.be.false;
      
      // Submit attestation
      const productId = ethers.keccak256(ethers.toUtf8Bytes("product1"));
      const deadline = (await time.latest()) + 3600;
      const nonce = await oracleIntegration.nonces(oracleSource1.address);
      
      const attestation = {
        requestId: requestId,
        productId: productId,
        verdict: true,
        evidenceURI: "ipfs://QmEvidence1",
        readingCode: 1,
        readingValue: 25,
        timestamp: await time.latest(),
        deadline: deadline,
        nonce: nonce
      };
      
      const signature = await oracleSource1.signTypedData(domain, types, attestation);
      await oracleIntegration.submitAttestation(attestation, signature);
      
      expect(await oracleIntegration.hasSourceAttested(requestId, oracleSource1.address)).to.be.true;
    });
  });

  describe("Pausable Functionality", function () {
    beforeEach(async function () {
      await oracleIntegration.registerSource(oracleSource1.address, 0, 100);
    });

    it("Should prevent submissions when paused", async function () {
      await oracleIntegration.pause();
      
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      const productId = ethers.keccak256(ethers.toUtf8Bytes("product1"));
      const deadline = (await time.latest()) + 3600;
      const nonce = await oracleIntegration.nonces(oracleSource1.address);
      
      const attestation = {
        requestId: requestId,
        productId: productId,
        verdict: true,
        evidenceURI: "ipfs://QmEvidence1",
        readingCode: 1,
        readingValue: 25,
        timestamp: await time.latest(),
        deadline: deadline,
        nonce: nonce
      };
      
      const signature = await oracleSource1.signTypedData(domain, types, attestation);
      
      await expect(oracleIntegration.submitAttestation(attestation, signature))
        .to.be.revertedWithCustomError(oracleIntegration, "EnforcedPause");
    });

    it("Should allow admin to pause and unpause", async function () {
      await oracleIntegration.pause();
      expect(await oracleIntegration.paused()).to.be.true;
      
      await oracleIntegration.unpause();
      expect(await oracleIntegration.paused()).to.be.false;
    });
  });
});
