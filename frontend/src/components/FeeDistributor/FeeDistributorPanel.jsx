import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../Common/Card';
import { Button } from '../Common/Button';
import LoadingSpinner from '../Common/LoadingSpinner';
import { useWallet } from '../../contexts/WalletContext';
import { useContracts } from '../../hooks/useContracts';
import { ethers } from 'ethers';

const FeeDistributorPanel = () => {
  const { account, signer } = useWallet();
  const { feeDistributor } = useContracts();
  
  const [distributions, setDistributions] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [userEarnings, setUserEarnings] = useState({
    total: '0',
    pending: '0',
    claimed: '0'
  });
  const [poolBalance, setPoolBalance] = useState('0');
  const [distributionHistory, setDistributionHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Load fee distribution data
  const loadDistributions = useCallback(async () => {
    if (!feeDistributor || !account) return;
    
    try {
      setLoading(true);
      
      // Get current pool balance
      const balance = await feeDistributor.getPoolBalance();
      setPoolBalance(ethers.formatEther(balance));
      
      // Get user earnings
      const pending = await feeDistributor.getPendingEarnings(account);
      const claimed = await feeDistributor.getClaimedEarnings(account);
      const total = pending + claimed;
      
      setUserEarnings({
        total: ethers.formatEther(total),
        pending: ethers.formatEther(pending),
        claimed: ethers.formatEther(claimed)
      });
      
      // Mock distribution data for demo
      const distributionList = [
        {
          id: 1,
          type: 'Transaction Fees',
          amount: '0.5',
          timestamp: new Date(Date.now() - 60000),
          source: 'Marketplace',
          recipients: 15,
          status: 'Distributed'
        },
        {
          id: 2,
          type: 'Verification Fees',
          amount: '0.2',
          timestamp: new Date(Date.now() - 120000),
          source: 'VerificationManager',
          recipients: 8,
          status: 'Distributed'
        },
        {
          id: 3,
          type: 'Dispute Fees',
          amount: '0.1',
          timestamp: new Date(Date.now() - 180000),
          source: 'DisputeResolution',
          recipients: 5,
          status: 'Pending'
        }
      ];
      
      setDistributions(distributionList);
      
    } catch (error) {
      console.error('Error loading distributions:', error);
    } finally {
      setLoading(false);
    }
  }, [feeDistributor, account]);

  // Load beneficiaries
  const loadBeneficiaries = useCallback(async () => {
    if (!feeDistributor) return;
    
    try {
      // Mock beneficiary data for demo
      const beneficiaryList = [
        {
          address: '0x742d35Cc6C4C3A0A5A9f3c75F78fE3e53A9B76b0',
          role: 'Verifier',
          share: 25,
          earned: '2.5',
          reputation: 95
        },
        {
          address: '0x8ba1f109551bD432803012645Hac136c4c93B6bf',
          role: 'Arbiter',
          share: 20,
          earned: '2.0',
          reputation: 88
        },
        {
          address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
          role: 'Oracle',
          share: 15,
          earned: '1.5',
          reputation: 92
        },
        {
          address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
          role: 'Developer',
          share: 10,
          earned: '1.0',
          reputation: 85
        },
        {
          address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
          role: 'Community',
          share: 30,
          earned: '3.0',
          reputation: 90
        }
      ];
      
      setBeneficiaries(beneficiaryList);
    } catch (error) {
      console.error('Error loading beneficiaries:', error);
    }
  }, [feeDistributor]);

  // Load distribution history
  const loadDistributionHistory = useCallback(async () => {
    if (!feeDistributor) return;
    
    try {
      // Mock historical data for demo
      const historyList = [];
      for (let i = 0; i < 30; i++) {
        historyList.push({
          id: i + 1,
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          amount: (Math.random() * 2 + 0.1).toFixed(3),
          recipients: Math.floor(Math.random() * 20 + 5),
          avgPayout: (Math.random() * 0.5 + 0.01).toFixed(4),
          type: ['Transaction', 'Verification', 'Dispute', 'Governance'][i % 4] + ' Fees'
        });
      }
      
      setDistributionHistory(historyList);
    } catch (error) {
      console.error('Error loading distribution history:', error);
    }
  }, [feeDistributor]);

  // Claim earnings
  const claimEarnings = async () => {
    if (!feeDistributor || !signer) return;
    
    try {
      setLoading(true);
      const tx = await feeDistributor.claimEarnings();
      await tx.wait();
      
      alert('Earnings claimed successfully!');
      loadDistributions();
    } catch (error) {
      console.error('Error claiming earnings:', error);
      alert('Claiming failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Distribute fees (admin only)
  const distributeFees = async () => {
    if (!feeDistributor || !signer) return;
    
    try {
      setLoading(true);
      const tx = await feeDistributor.distributeFees();
      await tx.wait();
      
      alert('Fees distributed successfully!');
      loadDistributions();
    } catch (error) {
      console.error('Error distributing fees:', error);
      alert('Distribution failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (feeDistributor && account) {
      loadDistributions();
      loadBeneficiaries();
      loadDistributionHistory();
    }
  }, [feeDistributor, account, loadDistributions, loadBeneficiaries, loadDistributionHistory]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Distributed': return 'bg-green-100 text-green-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Verifier': return 'bg-purple-100 text-purple-800';
      case 'Arbiter': return 'bg-blue-100 text-blue-800';
      case 'Oracle': return 'bg-green-100 text-green-800';
      case 'Developer': return 'bg-orange-100 text-orange-800';
      case 'Community': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'distributions', label: 'Recent Distributions', icon: '💰', count: distributions.length },
    { id: 'beneficiaries', label: 'Beneficiaries', icon: '👥', count: beneficiaries.length },
    { id: 'analytics', label: 'Analytics', icon: '📈' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">💰 Fee Distributor</h2>
        <p className="text-gray-600">The Reward Distributor (Revenue Sharing)</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{poolBalance} ETH</div>
            <div className="text-sm text-gray-600">Pool Balance</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{userEarnings.total} ETH</div>
            <div className="text-sm text-gray-600">Total Earned</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{userEarnings.pending} ETH</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{beneficiaries.length}</div>
            <div className="text-sm text-gray-600">Beneficiaries</div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            <p className="text-sm text-gray-600">Manage your earnings and distributions</p>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="success"
              onClick={claimEarnings}
              disabled={loading || parseFloat(userEarnings.pending) === 0}
            >
              Claim Earnings ({userEarnings.pending} ETH)
            </Button>
            <Button
              variant="primary"
              onClick={distributeFees}
              disabled={loading}
            >
              Distribute Pool
            </Button>
          </div>
        </div>
      </Card>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-colors ${
              activeTab === tab.id 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="font-medium">{tab.label}</span>
            {tab.count !== undefined && (
              <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner message="Loading fee distribution data..." />}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Fee Distribution Dashboard</h3>
          
          {/* Your Earnings */}
          <Card>
            <h4 className="font-medium text-gray-900 mb-4">Your Earnings Breakdown</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">{userEarnings.total}</div>
                <div className="text-gray-600">Total Earned (ETH)</div>
                <div className="text-sm text-gray-500 mt-1">Lifetime earnings</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600 mb-2">{userEarnings.pending}</div>
                <div className="text-gray-600">Pending (ETH)</div>
                <div className="text-sm text-gray-500 mt-1">Available to claim</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">{userEarnings.claimed}</div>
                <div className="text-gray-600">Claimed (ETH)</div>
                <div className="text-sm text-gray-500 mt-1">Already withdrawn</div>
              </div>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card>
            <h4 className="font-medium text-gray-900 mb-4">Recent Distribution Activity</h4>
            <div className="space-y-3">
              {distributions.slice(0, 5).map((dist) => (
                <div key={dist.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <div className="font-medium text-gray-900">{dist.type}</div>
                    <div className="text-sm text-gray-600">{dist.source} • {dist.recipients} recipients</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{dist.amount} ETH</div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dist.status)}`}>
                      {dist.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Pool Statistics */}
          <Card>
            <h4 className="font-medium text-gray-900 mb-4">Pool Statistics</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-medium text-gray-700 mb-3">Distribution by Source</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Marketplace Fees</span>
                    <span className="text-sm font-medium">45%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Verification Fees</span>
                    <span className="text-sm font-medium">25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Dispute Fees</span>
                    <span className="text-sm font-medium">20%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Other</span>
                    <span className="text-sm font-medium">10%</span>
                  </div>
                </div>
              </div>
              <div>
                <h5 className="font-medium text-gray-700 mb-3">Distribution by Role</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Community</span>
                    <span className="text-sm font-medium">30%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Verifiers</span>
                    <span className="text-sm font-medium">25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Arbiters</span>
                    <span className="text-sm font-medium">20%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Oracles</span>
                    <span className="text-sm font-medium">15%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Developers</span>
                    <span className="text-sm font-medium">10%</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Distributions Tab */}
      {activeTab === 'distributions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Recent Distributions</h3>
            <Button variant="secondary" onClick={loadDistributions} disabled={loading}>
              Refresh
            </Button>
          </div>
          
          {distributions.length === 0 ? (
            <Card>
              <div className="text-center py-8 text-gray-500">
                No distributions found
              </div>
            </Card>
          ) : (
            distributions.map((dist) => (
              <Card key={dist.id}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">{dist.type}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dist.status)}`}>
                        {dist.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Amount:</span> {dist.amount} ETH</p>
                      <p><span className="font-medium">Source:</span> {dist.source}</p>
                      <p><span className="font-medium">Recipients:</span> {dist.recipients} users</p>
                      <p><span className="font-medium">Time:</span> {dist.timestamp.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">{dist.amount} ETH</div>
                    <div className="text-sm text-gray-600">
                      ~{(parseFloat(dist.amount) / dist.recipients).toFixed(4)} ETH per user
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Beneficiaries Tab */}
      {activeTab === 'beneficiaries' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Fee Beneficiaries</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {beneficiaries.map((beneficiary, index) => (
              <Card key={index}>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(beneficiary.role)}`}>
                          {beneficiary.role}
                        </span>
                        <span className="text-sm text-gray-600">
                          {beneficiary.address.slice(0, 6)}...{beneficiary.address.slice(-4)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Share: {beneficiary.share}% • Reputation: {beneficiary.reputation}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600">{beneficiary.earned} ETH</div>
                      <div className="text-sm text-gray-600">Total Earned</div>
                    </div>
                  </div>
                  
                  {/* Reputation Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Reputation</span>
                      <span className="font-medium">{beneficiary.reputation}%</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          beneficiary.reputation >= 90 ? 'bg-green-500' :
                          beneficiary.reputation >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${beneficiary.reputation}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Distribution Analytics</h3>
          
          {/* Distribution Timeline */}
          <Card>
            <h4 className="font-medium text-gray-900 mb-4">Distribution History (Last 30 Days)</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {distributionHistory.map((entry) => (
                <div key={entry.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {entry.date.toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-600">{entry.type}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{entry.amount} ETH</div>
                    <div className="text-xs text-gray-600">{entry.recipients} recipients</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {distributionHistory.reduce((sum, entry) => sum + parseFloat(entry.amount), 0).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Total Distributed (30d)</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {(distributionHistory.reduce((sum, entry) => sum + parseFloat(entry.amount), 0) / 30).toFixed(3)}
                </div>
                <div className="text-sm text-gray-600">Avg Daily Distribution</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(distributionHistory.reduce((sum, entry) => sum + entry.recipients, 0) / distributionHistory.length)}
                </div>
                <div className="text-sm text-gray-600">Avg Recipients</div>
              </div>
            </Card>
          </div>

          {/* Fee Sources Breakdown */}
          <Card>
            <h4 className="font-medium text-gray-900 mb-4">Fee Sources Performance</h4>
            <div className="space-y-4">
              {[
                { source: 'Marketplace Transactions', amount: '5.2', percentage: 45, growth: '+12%' },
                { source: 'Verification Services', amount: '2.9', percentage: 25, growth: '+8%' },
                { source: 'Dispute Resolutions', amount: '2.3', percentage: 20, growth: '+15%' },
                { source: 'Governance Actions', amount: '1.2', percentage: 10, growth: '+5%' }
              ].map((source, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{source.source}</span>
                      <span className="text-sm text-gray-600">{source.amount} ETH ({source.percentage}%)</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${source.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="ml-4 text-sm font-medium text-green-600">{source.growth}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FeeDistributorPanel;
