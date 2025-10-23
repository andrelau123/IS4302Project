// Contract addresses - Update these with your deployed contract addresses
export const CONTRACT_ADDRESSES = {
  FEE_DISTRIBUTOR: process.env.REACT_APP_FEE_DISTRIBUTOR_ADDRESS,
  AUTH_TOKEN: process.env.REACT_APP_AUTH_TOKEN_ADDRESS, // Replace with actual deployed address
  PRODUCT_REGISTRY: process.env.REACT_APP_PRODUCT_REGISTRY_ADDRESS || "0x...", // Replace with actual deployed address
  PRODUCT_NFT: process.env.REACT_APP_PRODUCT_NFT_ADDRESS || "0x...", // Replace with actual deployed address
  RETAILER_REGISTRY: process.env.REACT_APP_RETAILER_REGISTRY_ADDRESS || "0x...", // Replace with actual deployed address
  VERIFICATION_MANAGER:
    process.env.REACT_APP_VERIFICATION_MANAGER_ADDRESS || "0x...", // Replace with actual deployed address
  DISPUTE_RESOLUTION:
    process.env.REACT_APP_DISPUTE_RESOLUTION_ADDRESS || "0x...", // Replace with actual deployed address
  GOVERNANCE_VOTING: process.env.REACT_APP_GOVERNANCE_VOTING_ADDRESS || "0x...", // Replace with actual deployed address
  ORACLE_INTEGRATION:
    process.env.REACT_APP_ORACLE_INTEGRATION_ADDRESS || "0x...", // Replace with actual deployed address
};

// Network configuration
export const NETWORK_CONFIG = {
  chainId: 31337, // Hardhat default
  name: "Hardhat Local",
  rpcUrl: "http://127.0.0.1:8545",
};

// Fee distribution shares (in basis points)
export const DEFAULT_SHARES = {
  VERIFIER: 4000, // 40%
  BRAND: 4000, // 40%
  TREASURY: 2000, // 20%
};

// Role constants
export const ROLES = {
  DEFAULT_ADMIN_ROLE:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  DISTRIBUTOR_ROLE:
    "0x4c6963cf831a14cb00a936eec3e28b9dbc7b5a1e1f0863e8c66aa1e3f0a1c222",
  MANUFACTURER_ROLE: "0x...", // Replace with actual role hash
  VERIFIER_ROLE: "0x...", // Replace with actual role hash
  REGISTRY_ADMIN_ROLE: "0x...", // Replace with actual role hash
  MINTER_ROLE: "0x...", // Replace with actual role hash
};

// Transaction statuses
export const TX_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
};

// Product Status Constants
export const PRODUCT_STATUS = {
  REGISTERED: 0,
  IN_TRANSIT: 1,
  AT_RETAILER: 2,
  SOLD: 3,
  DISPUTED: 4,
};

// Product Status Labels
export const PRODUCT_STATUS_LABELS = {
  [PRODUCT_STATUS.REGISTERED]: "Registered",
  [PRODUCT_STATUS.IN_TRANSIT]: "In Transit",
  [PRODUCT_STATUS.AT_RETAILER]: "At Retailer",
  [PRODUCT_STATUS.SOLD]: "Sold",
  [PRODUCT_STATUS.DISPUTED]: "Disputed",
};

// Event names
export const EVENTS = {
  REVENUE_DISTRIBUTED: "RevenueDistributed",
  REWARDS_CLAIMED: "RewardsClaimed",
  SHARES_UPDATED: "SharesUpdated",
  PRODUCT_REGISTERED: "ProductRegistered",
  PRODUCT_TRANSFERRED: "ProductTransferred",
  PRODUCT_STATUS_CHANGED: "ProductStatusChanged",
  PRODUCT_NFT_MINTED: "ProductNFTMinted",
  VERIFICATION_RECORDED: "VerificationRecorded",
};

// Default pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
};
