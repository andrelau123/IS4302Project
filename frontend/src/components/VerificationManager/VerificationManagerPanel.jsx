import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../Common/Card';
import { Button } from '../Common/Button';
import LoadingSpinner from '../Common/LoadingSpinner';
import { useWallet } from '../../contexts/WalletContext';
import { useContracts } from '../../hooks/useContracts';

const VerificationManagerPanel = () => {
  const { account, signer } = useWallet();
  const { verificationManager } = useContracts();
  
  const [requests, setRequests] = useState([]);
  const [userRole, setUserRole] = useState('none');
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [newRequest, setNewRequest] = useState({
    targetAddress: '',
    requestType: '',
    data: ''
  });

  // Load verification requests
  const loadRequests = useCallback(async () => {
    if (!verificationManager || !account) return;
    
    try {
      setLoading(true);
      
      // Get total request count
      const requestCount = await verificationManager.requestCount();
      const requestList = [];
      
      for (let i = 1; i <= requestCount; i++) {
        try {
          const request = await verificationManager.requests(i);
          const requestInfo = await verificationManager.getRequestInfo(i);
          
          const isPending = request.status === 0; // PENDING
          const isApproved = request.status === 1; // APPROVED  
          const isRejected = request.status === 2; // REJECTED
          const isExpired = request.status === 3; // EXPIRED
          
          // Check if request has expired based on timeout
          const currentTime = Math.floor(Date.now() / 1000);
          const timeoutPeriod = await verificationManager.VERIFICATION_TIMEOUT();
          const isTimedOut = currentTime > (Number(request.timestamp) + Number(timeoutPeriod));
          
          requestList.push({
            id: i,
            requester: request.requester,
            targetAddress: request.targetAddress,
            requestType: request.requestType,
            data: request.data,
            timestamp: new Date(Number(request.timestamp) * 1000),
            verifier: request.verifier,
            result: request.result,
            votes: {
              approve: Number(requestInfo.approveVotes),
              reject: Number(requestInfo.rejectVotes),
              total: Number(requestInfo.approveVotes) + Number(requestInfo.rejectVotes)
            },
            isPending,
            isApproved,
            isRejected,
            isExpired,
            isTimedOut,
            status: isExpired ? 'Expired' : isApproved ? 'Approved' : isRejected ? 'Rejected' : isPending ? 'Pending' : 'Unknown'
          });
        } catch (error) {
          console.error(`Error loading request ${i}:`, error);
        }
      }
      
      setRequests(requestList);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  }, [verificationManager, account]);

  // Load verifiers
  const loadVerifiers = useCallback(async () => {
    if (!verificationManager) return;
    
    try {
      // This would require events or additional contract methods to get all verifiers
      // For now, we'll show the current user's verifier status if applicable
      if (account && userRole === 'verifier') {
        const profile = await verificationManager.verifiers(account);
        setUserProfile({
          isActive: profile.isActive,
          reputationScore: Number(profile.reputationScore),
          verificationsCount: Number(profile.verificationsCount)
        });
      }
    } catch (error) {
      console.error('Error loading verifiers:', error);
    }
  }, [verificationManager, account, userRole]);

  // Check user role
  const checkUserRole = useCallback(async () => {
    if (!verificationManager || !account) return;
    
    try {
      const verifier = await verificationManager.verifiers(account);
      if (verifier.isActive) {
        setUserRole('verifier');
      } else {
        setUserRole('user');
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      setUserRole('user');
    }
  }, [verificationManager, account]);

  // Create verification request
  const createRequest = async (e) => {
    e.preventDefault();
    if (!verificationManager || !signer) return;
    
    try {
      setLoading(true);
      const tx = await verificationManager.requestVerification(
        newRequest.targetAddress,
        newRequest.requestType,
        newRequest.data
      );
      await tx.wait();
      
      alert('Verification request created successfully!');
      setNewRequest({ targetAddress: '', requestType: '', data: '' });
      loadRequests();
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Request creation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Vote on verification (verifier only)
  const voteOnRequest = async (requestId, approve) => {
    if (!verificationManager || !signer) return;
    
    try {
      setLoading(true);
      const tx = await verificationManager.vote(requestId, approve);
      await tx.wait();
      
      alert(`Vote ${approve ? 'approve' : 'reject'} submitted successfully!`);
      loadRequests();
    } catch (error) {
      console.error('Error voting:', error);
      alert('Voting failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Process expired requests
  const processExpiredRequest = async (requestId) => {
    if (!verificationManager || !signer) return;
    
    try {
      setLoading(true);
      const tx = await verificationManager.processExpiredRequest(requestId);
      await tx.wait();
      
      alert('Expired request processed successfully!');
      loadRequests();
    } catch (error) {
      console.error('Error processing expired request:', error);
      alert('Processing failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account && verificationManager) {
      loadRequests();
      checkUserRole();
    }
  }, [account, verificationManager, loadRequests, checkUserRole]);

  useEffect(() => {
    if (userRole === 'verifier') {
      loadVerifiers();
    }
  }, [userRole, loadVerifiers]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTimeRemaining = (timestamp, timeoutSeconds = 7 * 24 * 60 * 60) => {
    const expiryTime = timestamp.getTime() + (timeoutSeconds * 1000);
    const now = new Date().getTime();
    const remaining = Math.max(0, expiryTime - now);
    
    if (remaining === 0) return 'Expired';
    
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const pendingRequests = requests.filter(r => r.isPending && !r.isTimedOut);
  const completedRequests = requests.filter(r => r.isApproved || r.isRejected || r.isExpired);
  const myRequests = requests.filter(r => r.requester.toLowerCase() === account?.toLowerCase());

  const tabs = [
    { id: 'pending', label: 'Pending Requests', icon: '⏳', count: pendingRequests.length },
    { id: 'completed', label: 'Completed', icon: '✅', count: completedRequests.length },
    { id: 'my', label: 'My Requests', icon: '👤', count: myRequests.length },
    { id: 'create', label: 'Request Verification', icon: '🔍' }
  ];

  // Add verifier profile tab if user is a verifier
  if (userRole === 'verifier') {
    tabs.splice(3, 0, { id: 'profile', label: 'Verifier Profile', icon: '👨‍💼' });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">🔍 Verification Manager</h2>
        <p className="text-gray-600">The Trust Guardian (Verification System)</p>
        <div className="mt-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            userRole === 'verifier' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {userRole === 'verifier' ? '👨‍💼 Verifier' : '👤 User'}
          </span>
        </div>
      </div>

      {/* Verifier Profile Summary */}
      {userRole === 'verifier' && userProfile && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{userProfile.verificationsCount}</div>
              <div className="text-sm text-gray-600">Verifications</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{userProfile.reputationScore}</div>
              <div className="text-sm text-gray-600">Reputation Score</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${userProfile.isActive ? 'text-green-600' : 'text-red-600'}`}>
                {userProfile.isActive ? 'Active' : 'Inactive'}
              </div>
              <div className="text-sm text-gray-600">Status</div>
            </div>
          </div>
        </Card>
      )}

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

      {loading && <LoadingSpinner message="Loading verification data..." />}

      {/* Pending Requests Tab */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Pending Verification Requests</h3>
            <Button variant="secondary" onClick={loadRequests} disabled={loading}>
              Refresh
            </Button>
          </div>
          
          {pendingRequests.length === 0 ? (
            <Card>
              <div className="text-center py-8 text-gray-500">
                No pending verification requests
              </div>
            </Card>
          ) : (
            pendingRequests.map((request) => (
              <Card key={request.id}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Request #{request.id}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          ⏰ {getTimeRemaining(request.timestamp)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><span className="font-medium">Type:</span> {request.requestType}</p>
                        <p><span className="font-medium">Target:</span> {request.targetAddress.slice(0, 6)}...{request.targetAddress.slice(-4)}</p>
                        <p><span className="font-medium">Requester:</span> {request.requester.slice(0, 6)}...{request.requester.slice(-4)}</p>
                        <p><span className="font-medium">Created:</span> {request.timestamp.toLocaleString()}</p>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Request Data:</p>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{request.data}</p>
                      </div>
                    </div>
                  </div>

                  {/* Voting Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{request.votes.approve}</div>
                      <div className="text-sm text-gray-600">Approve Votes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{request.votes.reject}</div>
                      <div className="text-sm text-gray-600">Reject Votes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{request.votes.total}</div>
                      <div className="text-sm text-gray-600">Total Votes</div>
                    </div>
                  </div>

                  {/* Verifier Actions */}
                  {userRole === 'verifier' && (
                    <div className="border-t pt-4">
                      <h5 className="font-medium text-gray-900 mb-3">Verifier Actions</h5>
                      <div className="flex justify-center space-x-4">
                        <Button
                          variant="success"
                          onClick={() => voteOnRequest(request.id, true)}
                          disabled={loading}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => voteOnRequest(request.id, false)}
                          disabled={loading}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Timeout Actions */}
                  {request.isTimedOut && (
                    <div className="border-t pt-4">
                      <div className="flex justify-center">
                        <Button
                          variant="secondary"
                          onClick={() => processExpiredRequest(request.id)}
                          disabled={loading}
                        >
                          Process Expired Request
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Completed Requests Tab */}
      {activeTab === 'completed' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Completed Verification Requests</h3>
          
          {completedRequests.length === 0 ? (
            <Card>
              <div className="text-center py-8 text-gray-500">
                No completed verification requests
              </div>
            </Card>
          ) : (
            completedRequests.map((request) => (
              <Card key={request.id}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Request #{request.id}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><span className="font-medium">Type:</span> {request.requestType}</p>
                        <p><span className="font-medium">Target:</span> {request.targetAddress.slice(0, 6)}...{request.targetAddress.slice(-4)}</p>
                        <p><span className="font-medium">Verifier:</span> {request.verifier ? `${request.verifier.slice(0, 6)}...${request.verifier.slice(-4)}` : 'N/A'}</p>
                      </div>
                      
                      {request.result && (
                        <div className={`mt-3 p-3 rounded-lg ${
                          request.isApproved ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                          <h5 className={`font-medium mb-1 ${
                            request.isApproved ? 'text-green-900' : 'text-red-900'
                          }`}>
                            Verification Result:
                          </h5>
                          <p className={request.isApproved ? 'text-green-800' : 'text-red-800'}>
                            {request.result}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Final Vote Tally */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{request.votes.approve}</div>
                      <div className="text-sm text-gray-600">Final Approve Votes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-600">{request.votes.reject}</div>
                      <div className="text-sm text-gray-600">Final Reject Votes</div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* My Requests Tab */}
      {activeTab === 'my' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">My Verification Requests</h3>
          
          {myRequests.length === 0 ? (
            <Card>
              <div className="text-center py-8 text-gray-500">
                You haven't submitted any verification requests
              </div>
            </Card>
          ) : (
            myRequests.map((request) => (
              <Card key={request.id}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Request #{request.id}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                        {request.isPending && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            ⏰ {getTimeRemaining(request.timestamp)}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><span className="font-medium">Type:</span> {request.requestType}</p>
                        <p><span className="font-medium">Target:</span> {request.targetAddress.slice(0, 6)}...{request.targetAddress.slice(-4)}</p>
                        <p><span className="font-medium">Data:</span> {request.data}</p>
                      </div>
                      
                      {request.result && (
                        <div className={`mt-3 p-3 rounded-lg ${
                          request.isApproved ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                          <h5 className={`font-medium mb-1 ${
                            request.isApproved ? 'text-green-900' : 'text-red-900'
                          }`}>
                            Verification Result:
                          </h5>
                          <p className={request.isApproved ? 'text-green-800' : 'text-red-800'}>
                            {request.result}
                          </p>
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

      {/* Verifier Profile Tab */}
      {activeTab === 'profile' && userRole === 'verifier' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Verifier Profile</h3>
          
          {userProfile ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">{userProfile.verificationsCount}</div>
                  <div className="text-gray-600">Total Verifications</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">{userProfile.reputationScore}</div>
                  <div className="text-gray-600">Reputation Score</div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold mb-2 ${userProfile.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {userProfile.isActive ? '✅' : '❌'}
                  </div>
                  <div className="text-gray-600">Verifier Status</div>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Verifier Responsibilities</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Review verification requests thoroughly</li>
                  <li>• Vote based on factual evidence</li>
                  <li>• Maintain high reputation through accurate decisions</li>
                  <li>• Process requests within the timeout period</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Loading verifier profile...
            </div>
          )}
        </Card>
      )}

      {/* Create Request Tab */}
      {activeTab === 'create' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Verification</h3>
          <form onSubmit={createRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Address
              </label>
              <input
                type="text"
                value={newRequest.targetAddress}
                onChange={(e) => setNewRequest({...newRequest, targetAddress: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Address to verify (e.g., 0x123...)"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Request Type
              </label>
              <select
                value={newRequest.requestType}
                onChange={(e) => setNewRequest({...newRequest, requestType: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select verification type</option>
                <option value="IDENTITY">Identity Verification</option>
                <option value="BUSINESS">Business Verification</option>
                <option value="PRODUCT">Product Authenticity</option>
                <option value="CERTIFICATE">Certificate Validation</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification Data
              </label>
              <textarea
                value={newRequest.data}
                onChange={(e) => setNewRequest({...newRequest, data: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="4"
                placeholder="Provide details and evidence for verification..."
                required
              />
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Note:</span> Verification requests will be reviewed by qualified verifiers. Provide accurate and detailed information to ensure proper verification. Requests expire after 7 days if not processed.
              </p>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Submit Verification Request'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
};

export default VerificationManagerPanel;
