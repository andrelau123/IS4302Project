import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../Common/Card';
import { Button } from '../Common/Button';
import LoadingSpinner from '../Common/LoadingSpinner';
import { useWallet } from '../../contexts/WalletContext';
import { useContracts } from '../../hooks/useContracts';
import { ethers } from 'ethers';

const GovernanceVotingPanel = () => {
  const { account, signer } = useWallet();
  const { governanceVoting, authToken } = useContracts();
  
  const [proposals, setProposals] = useState([]);
  const [userVoteWeight, setUserVoteWeight] = useState('0');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [newProposal, setNewProposal] = useState({
    description: '',
    votingPeriod: '7' // days
  });

  // Load active proposals
  const loadProposals = useCallback(async () => {
    if (!governanceVoting || !account) return;
    
    try {
      setLoading(true);
      
      // Get total proposal count
      const proposalCount = await governanceVoting.proposalCount();
      const proposalList = [];
      
      for (let i = 1; i <= proposalCount; i++) {
        try {
          const proposal = await governanceVoting.proposals(i);
          const votesFor = await governanceVoting.getVotes(i, true);
          const votesAgainst = await governanceVoting.getVotes(i, false);
          const totalVotes = votesFor + votesAgainst;
          const quorumRequired = await governanceVoting.quorumVotes();
          const quorumAchieved = (totalVotes * 100n) / quorumRequired;
          const hasVoted = await governanceVoting.hasVoted(i, account);
          
          const currentTime = Math.floor(Date.now() / 1000);
          const isActive = currentTime < Number(proposal.endTime);
          const isExecuted = proposal.executed;
          
          proposalList.push({
            id: i,
            description: proposal.description,
            proposer: proposal.proposer,
            startTime: new Date(Number(proposal.startTime) * 1000),
            endTime: new Date(Number(proposal.endTime) * 1000),
            votesFor: ethers.formatEther(votesFor),
            votesAgainst: ethers.formatEther(votesAgainst),
            totalVotes: ethers.formatEther(totalVotes),
            quorumAchieved: Number(quorumAchieved),
            quorumRequired: ethers.formatEther(quorumRequired),
            isActive,
            isExecuted,
            hasVoted,
            status: isExecuted ? 'Executed' : isActive ? 'Active' : 'Ended'
          });
        } catch (error) {
          console.error(`Error loading proposal ${i}:`, error);
        }
      }
      
      setProposals(proposalList);
    } catch (error) {
      console.error('Error loading proposals:', error);
    } finally {
      setLoading(false);
    }
  }, [governanceVoting, account]);

  // Load user's vote weight
  const loadUserVoteWeight = useCallback(async () => {
    if (!authToken || !account) return;
    
    try {
      const balance = await authToken.balanceOf(account);
      setUserVoteWeight(ethers.formatEther(balance));
    } catch (error) {
      console.error('Error loading user vote weight:', error);
    }
  }, [authToken, account]);

  // Vote on proposal
  const voteOnProposal = async (proposalId, support) => {
    if (!governanceVoting || !signer) return;
    
    try {
      setLoading(true);
      const tx = await governanceVoting.vote(proposalId, support);
      await tx.wait();
      
      alert(`Vote ${support ? 'for' : 'against'} proposal submitted successfully!`);
      loadProposals();
    } catch (error) {
      console.error('Error voting:', error);
      alert('Voting failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Create new proposal
  const createProposal = async (e) => {
    e.preventDefault();
    if (!governanceVoting || !signer) return;
    
    try {
      setLoading(true);
      const votingPeriodSeconds = parseInt(newProposal.votingPeriod) * 24 * 60 * 60;
      const tx = await governanceVoting.createProposal(
        newProposal.description,
        votingPeriodSeconds
      );
      await tx.wait();
      
      alert('Proposal created successfully!');
      setNewProposal({ description: '', votingPeriod: '7' });
      loadProposals();
    } catch (error) {
      console.error('Error creating proposal:', error);
      alert('Proposal creation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Execute proposal
  const executeProposal = async (proposalId) => {
    if (!governanceVoting || !signer) return;
    
    try {
      setLoading(true);
      const tx = await governanceVoting.executeProposal(proposalId);
      await tx.wait();
      
      alert('Proposal executed successfully!');
      loadProposals();
    } catch (error) {
      console.error('Error executing proposal:', error);
      alert('Proposal execution failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account && governanceVoting && authToken) {
      loadProposals();
      loadUserVoteWeight();
    }
  }, [account, governanceVoting, authToken, loadProposals, loadUserVoteWeight]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Ended': return 'bg-yellow-100 text-yellow-800';
      case 'Executed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getQuorumColor = (achieved) => {
    if (achieved >= 100) return 'text-green-600';
    if (achieved >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const activeProposals = proposals.filter(p => p.isActive);
  const endedProposals = proposals.filter(p => !p.isActive);

  const tabs = [
    { id: 'active', label: 'Active Proposals', icon: '🗳️', count: activeProposals.length },
    { id: 'ended', label: 'Past Proposals', icon: '📋', count: endedProposals.length },
    { id: 'create', label: 'Create Proposal', icon: '➕' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">🗳️ Governance Voting</h2>
        <p className="text-gray-600">The Decentralized Rulebook (DAO)</p>
      </div>

      {/* User Vote Weight */}
      <Card>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Voting Power</h3>
          <div className="text-3xl font-bold text-blue-600 mb-2">{userVoteWeight} AUTH</div>
          <p className="text-sm text-gray-600">
            Your vote weight is based on your AUTH token balance
          </p>
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

      {loading && <LoadingSpinner message="Loading proposals..." />}

      {/* Active Proposals Tab */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Active Proposals</h3>
            <Button variant="secondary" onClick={loadProposals} disabled={loading}>
              Refresh
            </Button>
          </div>
          
          {activeProposals.length === 0 ? (
            <Card>
              <div className="text-center py-8 text-gray-500">
                No active proposals
              </div>
            </Card>
          ) : (
            activeProposals.map((proposal) => (
              <Card key={proposal.id}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Proposal #{proposal.id}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                          {proposal.status}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-3">{proposal.description}</p>
                      <div className="text-sm text-gray-600">
                        <p><span className="font-medium">Proposer:</span> {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}</p>
                        <p><span className="font-medium">End Time:</span> {proposal.endTime.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Voting Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{proposal.votesFor}</div>
                      <div className="text-sm text-gray-600">Votes For</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{proposal.votesAgainst}</div>
                      <div className="text-sm text-gray-600">Votes Against</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getQuorumColor(proposal.quorumAchieved)}`}>
                        {proposal.quorumAchieved.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Quorum Achieved</div>
                    </div>
                  </div>

                  {/* Voting Buttons */}
                  <div className="flex justify-center space-x-4">
                    {proposal.hasVoted ? (
                      <div className="text-center text-sm text-gray-600">
                        ✅ You have already voted on this proposal
                      </div>
                    ) : parseFloat(userVoteWeight) > 0 ? (
                      <>
                        <Button
                          variant="success"
                          onClick={() => voteOnProposal(proposal.id, true)}
                          disabled={loading}
                        >
                          Vote For
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => voteOnProposal(proposal.id, false)}
                          disabled={loading}
                        >
                          Vote Against
                        </Button>
                      </>
                    ) : (
                      <div className="text-center text-sm text-red-600">
                        You need AUTH tokens to vote
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Past Proposals Tab */}
      {activeTab === 'ended' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Past Proposals</h3>
          
          {endedProposals.length === 0 ? (
            <Card>
              <div className="text-center py-8 text-gray-500">
                No past proposals
              </div>
            </Card>
          ) : (
            endedProposals.map((proposal) => (
              <Card key={proposal.id}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Proposal #{proposal.id}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                          {proposal.status}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-3">{proposal.description}</p>
                    </div>
                    {!proposal.isExecuted && proposal.quorumAchieved >= 100 && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => executeProposal(proposal.id)}
                        disabled={loading}
                      >
                        Execute
                      </Button>
                    )}
                  </div>

                  {/* Final Results */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{proposal.votesFor}</div>
                      <div className="text-sm text-gray-600">Final Votes For</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-600">{proposal.votesAgainst}</div>
                      <div className="text-sm text-gray-600">Final Votes Against</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-xl font-bold ${getQuorumColor(proposal.quorumAchieved)}`}>
                        {proposal.quorumAchieved.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Final Quorum</div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Create Proposal Tab */}
      {activeTab === 'create' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Proposal</h3>
          <form onSubmit={createProposal} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proposal Description
              </label>
              <textarea
                value={newProposal.description}
                onChange={(e) => setNewProposal({...newProposal, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="4"
                placeholder="Describe your proposal in detail..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voting Period (Days)
              </label>
              <input
                type="number"
                value={newProposal.votingPeriod}
                onChange={(e) => setNewProposal({...newProposal, votingPeriod: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="30"
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Proposal'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
};

export default GovernanceVotingPanel;
