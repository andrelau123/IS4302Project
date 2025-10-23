import { ethers } from 'ethers';

// Format ether values for display
export const formatEther = (value) => {
  if (!value) return '0';
  return parseFloat(ethers.formatEther(value)).toFixed(4);
};

// Format address for display (shows first 6 and last 4 characters)
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Format percentage from basis points
export const formatPercentage = (bps) => {
  if (!bps) return '0%';
  return `${(bps / 100).toFixed(2)}%`;
};

// Format large numbers with commas
export const formatNumber = (num) => {
  if (!num) return '0';
  return new Intl.NumberFormat().format(num);
};

// Parse ether input
export const parseEtherInput = (value) => {
  try {
    return ethers.parseEther(value || '0');
  } catch (error) {
    throw new Error('Invalid ether amount');
  }
};

// Validate Ethereum address
export const isValidAddress = (address) => {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

// Calculate share amounts
export const calculateShares = (totalAmount, shares) => {
  try {
    // Use ethers.js for big number operations
    const total = ethers.getBigInt(totalAmount);
    const verifierShare = ethers.getBigInt(shares.verifier);
    const brandShare = ethers.getBigInt(shares.brand);
    const BASIS_POINTS = ethers.getBigInt(10000);
    
    const verifierAmount = (total * verifierShare) / BASIS_POINTS;
    const brandAmount = (total * brandShare) / BASIS_POINTS;
    const treasuryAmount = total - verifierAmount - brandAmount;
    
    return {
      verifier: verifierAmount,
      brand: brandAmount,
      treasury: treasuryAmount,
    };
  } catch (error) {
    console.error('Error calculating shares:', error);
    return {
      verifier: ethers.getBigInt(0),
      brand: ethers.getBigInt(0),
      treasury: ethers.getBigInt(0),
    };
  }
};

// Format timestamp
export const formatTimestamp = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleString();
};

// Truncate text
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};
