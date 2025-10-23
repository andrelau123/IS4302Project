import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContracts } from './useContracts';
import { formatEther, parseEtherInput } from '../utils/formatters';

export const useFeeDistributor = () => {
  const { account, isConnected } = useWallet();
  const { feeDistributor, authToken } = useContracts();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingRewards, setPendingRewards] = useState('0');
  const [totalEarnings, setTotalEarnings] = useState('0');
  const [distributionShares, setDistributionShares] = useState({
    verifier: 0,
    brand: 0,
    treasury: 0,
  });
  const [totalDistributed, setTotalDistributed] = useState('0');
  const [authTokenBalance, setAuthTokenBalance] = useState('0');

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    if (!feeDistributor || !authToken || !account) {
      // If contracts aren't available, return early with default values
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Get pending rewards
      const pending = await feeDistributor.getPendingRewards(account);
      setPendingRewards(formatEther(pending));

      // Get total earnings
      const earnings = await feeDistributor.getTotalEarnings(account);
      setTotalEarnings(formatEther(earnings));

      // Get auth token balance
      const balance = await authToken.balanceOf(account);
      setAuthTokenBalance(formatEther(balance));

    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [feeDistributor, authToken, account]);

  // Fetch contract data
  const fetchContractData = useCallback(async () => {
    if (!feeDistributor) return;

    try {
      // Get distribution shares
      const verifierShare = await feeDistributor.verifierShare();
      const brandShare = await feeDistributor.brandShare();
      const treasuryShare = await feeDistributor.treasuryShare();
      
      setDistributionShares({
        verifier: Number(verifierShare),
        brand: Number(brandShare),
        treasury: Number(treasuryShare),
      });

      // Get total distributed
      const total = await feeDistributor.totalDistributed();
      setTotalDistributed(formatEther(total));

    } catch (err) {
      console.error('Error fetching contract data:', err);
      setError(err.message);
    }
  }, [feeDistributor]);

  // Claim rewards
  const claimRewards = async () => {
    if (!feeDistributor || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      const tx = await feeDistributor.claimRewards();
      await tx.wait();

      // Refresh user data
      await fetchUserData();
      
      return tx;
    } catch (err) {
      console.error('Error claiming rewards:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Distribute revenue (admin function)
  const distributeRevenue = async (verifierAddress, brandAddress, amount) => {
    if (!feeDistributor || !authToken || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      const amountWei = parseEtherInput(amount);

      // First approve the fee distributor to spend tokens
      const approveTx = await authToken.approve(feeDistributor.target, amountWei);
      await approveTx.wait();

      // Then distribute the revenue
      const distributeTx = await feeDistributor.distributeRevenue(
        verifierAddress,
        brandAddress,
        amountWei
      );
      await distributeTx.wait();

      // Refresh data
      await fetchUserData();
      await fetchContractData();

      return distributeTx;
    } catch (err) {
      console.error('Error distributing revenue:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update distribution shares (admin function)
  const updateShares = async (verifierShare, brandShare, treasuryShare) => {
    if (!feeDistributor || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      const tx = await feeDistributor.setDistributionShares(
        verifierShare,
        brandShare,
        treasuryShare
      );
      await tx.wait();

      // Refresh contract data
      await fetchContractData();

      return tx;
    } catch (err) {
      console.error('Error updating shares:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Check if user has admin role
  const checkAdminRole = useCallback(async () => {
    if (!feeDistributor || !account) return false;

    try {
      const DEFAULT_ADMIN_ROLE = await feeDistributor.DEFAULT_ADMIN_ROLE();
      return await feeDistributor.hasRole(DEFAULT_ADMIN_ROLE, account);
    } catch (err) {
      console.error('Error checking admin role:', err);
      return false;
    }
  }, [feeDistributor, account]);

  // Check if user has distributor role
  const checkDistributorRole = useCallback(async () => {
    if (!feeDistributor || !account) return false;

    try {
      const DISTRIBUTOR_ROLE = await feeDistributor.DISTRIBUTOR_ROLE();
      return await feeDistributor.hasRole(DISTRIBUTOR_ROLE, account);
    } catch (err) {
      console.error('Error checking distributor role:', err);
      return false;
    }
  }, [feeDistributor, account]);

  // Effect to fetch data when dependencies change
  useEffect(() => {
    if (isConnected && feeDistributor && authToken) {
      fetchUserData();
      fetchContractData();
    }
  }, [isConnected, feeDistributor, authToken, fetchUserData, fetchContractData]);

  return {
    // State
    loading,
    error,
    pendingRewards,
    totalEarnings,
    distributionShares,
    totalDistributed,
    authTokenBalance,

    // Actions
    claimRewards,
    distributeRevenue,
    updateShares,
    refreshData: () => {
      fetchUserData();
      fetchContractData();
    },

    // Utils
    checkAdminRole,
    checkDistributorRole,
  };
};
