import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../Common/Card';
import { Button } from '../Common/Button';
import LoadingSpinner from '../Common/LoadingSpinner';
import { useWallet } from '../../contexts/WalletContext';
import { useContracts } from '../../hooks/useContracts';

const DisputeResolutionPanel = () => {
  const { account, signer } = useWallet();
  const { disputeResolution } = useContracts();
  
  const [disputes, setDisputes] = useState([]);
  const [userRole, setUserRole] = useState('none');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [newDispute, setNewDispute] = useState({
    tokenId: '',
    description: ''
  });

  // Load disputes
  const loadDisputes = useCallback(async () => {
    if (!disputeResolution || !account) return;
    
    try {
      setLoading(true);
      
      // Get total dispute count
      const disputeCount = await disputeResolution.disputeCount();
      const disputeList = [];
      
      for (let i = 1; i <= disputeCount; i++) {
        try {
          const dispute = await disputeResolution.disputes(i);
          const votes = await disputeResolution.getDisputeVotes(i);
          const userHasVoted = await disputeResolution.hasVotedOnDispute(i, account);
          
          const isActive = dispute.status === 0; // ACTIVE status
          const isResolved = dispute.status === 1; // RESOLVED status
          
          disputeList.push({
            id: i,
            tokenId: Number(dispute.tokenId),
            description: dispute.description,
            initiator: dispute.initiator,
            respondent: dispute.respondent,
            createdAt: new Date(Number(dispute.createdAt) * 1000),
            votesFor: Number(votes.votesFor),
            votesAgainst: Number(votes.votesAgainst),
            totalVotes: Number(votes.votesFor) + Number(votes.votesAgainst),
            resolution: dispute.resolution,
            isActive,
            isResolved,
            userHasVoted,
            status: isResolved ? 'Resolved' : isActive ? 'Active' : 'Closed'
          });
        } catch (error) {
          console.error(`Error loading dispute ${i}:`, error);
        }
      }
      
      setDisputes(disputeList);
    } catch (error) {
      console.error('Error loading disputes:', error);
    } finally {
      setLoading(false);
    }
  }, [disputeResolution, account]);

  // Check user role
  const checkUserRole = useCallback(async () => {
    if (!disputeResolution || !account) return;
    
    try {
      const isArbiter = await disputeResolution.arbiters(account);
      if (isArbiter) {
        setUserRole('arbiter');
      } else {
        setUserRole('user');
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      setUserRole('user');
    }
  }, [disputeResolution, account]);

  // Create new dispute
  const createDispute = async (e) => {
    e.preventDefault();
    if (!disputeResolution || !signer) return;
    
    try {
      setLoading(true);
      
      // First verify the user owns the NFT or is involved with it
      const tokenId = parseInt(newDispute.tokenId);
      const tx = await disputeResolution.createDispute(
        tokenId,
        newDispute.description
      );
      await tx.wait();
      
      alert('Dispute created successfully!');
      setNewDispute({ tokenId: '', description: '' });
      loadDisputes();
    } catch (error) {
      console.error('Error creating dispute:', error);
      alert('Dispute creation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Vote on dispute (arbiter only)
  const voteOnDispute = async (disputeId, votesFor) => {
    if (!disputeResolution || !signer) return;
    
    try {
      setLoading(true);
      const tx = await disputeResolution.voteOnDispute(disputeId, votesFor);
      await tx.wait();
      
      alert(`Vote ${votesFor ? 'for' : 'against'} submitted successfully!`);
      loadDisputes();
    } catch (error) {
      console.error('Error voting on dispute:', error);
      alert('Voting failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Resolve dispute
  const resolveDispute = async (disputeId, resolution) => {
    if (!disputeResolution || !signer) return;
    
    try {
      setLoading(true);
      const tx = await disputeResolution.resolveDispute(disputeId, resolution);
      await tx.wait();
      
      alert('Dispute resolved successfully!');
      loadDisputes();
    } catch (error) {
      console.error('Error resolving dispute:', error);
      alert('Resolution failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account && disputeResolution) {
      loadDisputes();
      checkUserRole();
    }
  }, [account, disputeResolution, loadDisputes, checkUserRole]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-yellow-100 text-yellow-800';
      case 'Resolved': return 'bg-green-100 text-green-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVotePercentage = (votesFor, totalVotes) => {
    if (totalVotes === 0) return 0;
    return ((votesFor / totalVotes) * 100).toFixed(1);
  };

  const activeDisputes = disputes.filter(d => d.isActive);
  const resolvedDisputes = disputes.filter(d => d.isResolved);
  const myDisputes = disputes.filter(d => 
    d.initiator.toLowerCase() === account?.toLowerCase() || 
    d.respondent.toLowerCase() === account?.toLowerCase()
  );

  const tabs = [
    { id: 'active', label: 'Active Disputes', icon: '⚖️', count: activeDisputes.length },
    { id: 'resolved', label: 'Resolved Disputes', icon: '✅', count: resolvedDisputes.length },
    { id: 'my', label: 'My Disputes', icon: '👤', count: myDisputes.length },
    { id: 'create', label: 'Create Dispute', icon: '🆘' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">⚖️ Dispute Resolution</h2>
        <p className="text-gray-600">The Fairness Enforcer (Court System)</p>
        <div className="mt-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            userRole === 'arbiter' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {userRole === 'arbiter' ? '⚖️ Arbiter' : '👤 User'}
          </span>
        </div>
      </div>

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

      {loading && <LoadingSpinner message="Loading disputes..." />}

      {/* Active Disputes Tab */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Active Disputes</h3>
            <Button variant="secondary" onClick={loadDisputes} disabled={loading}>
              Refresh
            </Button>
          </div>
          
          {activeDisputes.length === 0 ? (
            <Card>
              <div className="text-center py-8 text-gray-500">
                No active disputes
              </div>
            </Card>
          ) : (
            activeDisputes.map((dispute) => (
              <Card key={dispute.id}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Dispute #{dispute.id}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dispute.status)}`}>
                          {dispute.status}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-3">{dispute.description}</p>
                      <div className="text-sm text-gray-600">
                        <p><span className="font-medium">NFT Token ID:</span> #{dispute.tokenId}</p>
                        <p><span className="font-medium">Initiated by:</span> {dispute.initiator.slice(0, 6)}...{dispute.initiator.slice(-4)}</p>
                        <p><span className="font-medium">Against:</span> {dispute.respondent.slice(0, 6)}...{dispute.respondent.slice(-4)}</p>
                        <p><span className="font-medium">Created:</span> {dispute.createdAt.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Voting Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{dispute.votesFor}</div>
                      <div className="text-sm text-gray-600">Votes For Initiator</div>
                      <div className="text-xs text-gray-500">
                        {getVotePercentage(dispute.votesFor, dispute.totalVotes)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{dispute.votesAgainst}</div>
                      <div className="text-sm text-gray-600">Votes For Respondent</div>
                      <div className="text-xs text-gray-500">
                        {getVotePercentage(dispute.votesAgainst, dispute.totalVotes)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{dispute.totalVotes}</div>
                      <div className="text-sm text-gray-600">Total Votes</div>
                    </div>
                  </div>

                  {/* Arbiter Voting */}
                  {userRole === 'arbiter' && (
                    <div className="border-t pt-4">
                      <h5 className="font-medium text-gray-900 mb-3">Arbiter Actions</h5>
                      {dispute.userHasVoted ? (
                        <div className="text-center text-sm text-gray-600">
                          ✅ You have already voted on this dispute
                        </div>
                      ) : (
                        <div className="flex justify-center space-x-4">
                          <Button
                            variant="success"
                            onClick={() => voteOnDispute(dispute.id, true)}
                            disabled={loading}
                          >
                            Vote for Initiator
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => voteOnDispute(dispute.id, false)}
                            disabled={loading}
                          >
                            Vote for Respondent
                          </Button>
                        </div>
                      )}
                      
                      {dispute.totalVotes >= 3 && ( // Require minimum votes for resolution
                        <div className="mt-4">
                          <h6 className="font-medium text-gray-900 mb-2">Resolve Dispute:</h6>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              placeholder="Resolution details..."
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.target.value.trim()) {
                                  resolveDispute(dispute.id, e.target.value.trim());
                                  e.target.value = '';
                                }
                              }}
                            />
                            <Button
                              variant="primary"
                              onClick={(e) => {
                                const input = e.target.parentNode.querySelector('input');
                                if (input.value.trim()) {
                                  resolveDispute(dispute.id, input.value.trim());
                                  input.value = '';
                                }
                              }}
                              disabled={loading}
                            >
                              Resolve
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Resolved Disputes Tab */}
      {activeTab === 'resolved' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Resolved Disputes</h3>
          
          {resolvedDisputes.length === 0 ? (
            <Card>
              <div className="text-center py-8 text-gray-500">
                No resolved disputes
              </div>
            </Card>
          ) : (
            resolvedDisputes.map((dispute) => (
              <Card key={dispute.id}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Dispute #{dispute.id}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dispute.status)}`}>
                          {dispute.status}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-3">{dispute.description}</p>
                      <div className="text-sm text-gray-600 mb-3">
                        <p><span className="font-medium">NFT Token ID:</span> #{dispute.tokenId}</p>
                        <p><span className="font-medium">Parties:</span> {dispute.initiator.slice(0, 6)}...{dispute.initiator.slice(-4)} vs {dispute.respondent.slice(0, 6)}...{dispute.respondent.slice(-4)}</p>
                      </div>
                      
                      {/* Resolution */}
                      <div className="bg-green-50 p-3 rounded-lg">
                        <h5 className="font-medium text-green-900 mb-1">Resolution:</h5>
                        <p className="text-green-800">{dispute.resolution}</p>
                      </div>
                    </div>
                  </div>

                  {/* Final Vote Tally */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{dispute.votesFor}</div>
                      <div className="text-sm text-gray-600">Final Votes For</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-600">{dispute.votesAgainst}</div>
                      <div className="text-sm text-gray-600">Final Votes Against</div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* My Disputes Tab */}
      {activeTab === 'my' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">My Disputes</h3>
          
          {myDisputes.length === 0 ? (
            <Card>
              <div className="text-center py-8 text-gray-500">
                You are not involved in any disputes
              </div>
            </Card>
          ) : (
            myDisputes.map((dispute) => (
              <Card key={dispute.id}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Dispute #{dispute.id}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dispute.status)}`}>
                          {dispute.status}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          dispute.initiator.toLowerCase() === account?.toLowerCase() 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {dispute.initiator.toLowerCase() === account?.toLowerCase() ? 'Initiator' : 'Respondent'}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-3">{dispute.description}</p>
                      
                      {dispute.isResolved && (
                        <div className="bg-green-50 p-3 rounded-lg">
                          <h5 className="font-medium text-green-900 mb-1">Resolution:</h5>
                          <p className="text-green-800">{dispute.resolution}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Create Dispute Tab */}
      {activeTab === 'create' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Dispute</h3>
          <form onSubmit={createDispute} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NFT Token ID
              </label>
              <input
                type="number"
                value={newDispute.tokenId}
                onChange={(e) => setNewDispute({...newDispute, tokenId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter NFT Token ID"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dispute Description
              </label>
              <textarea
                value={newDispute.description}
                onChange={(e) => setNewDispute({...newDispute, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="4"
                placeholder="Describe the dispute in detail..."
                required
              />
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Note:</span> You can only create disputes for NFTs you own or are involved with. Disputes should be used for legitimate issues such as authenticity concerns, delivery problems, or contract violations.
              </p>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Dispute'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
};

export default DisputeResolutionPanel;
