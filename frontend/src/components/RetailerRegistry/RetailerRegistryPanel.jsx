import React, { useState, useEffect } from 'react';
import { Card } from '../Common/Card';
import { Button } from '../Common/Button';
import LoadingSpinner from '../Common/LoadingSpinner';
import { useWallet } from '../../contexts/WalletContext';
import { useContracts } from '../../hooks/useContracts';

const RetailerRegistryPanel = () => {
  const { account, signer } = useWallet();
  const { retailerRegistry } = useContracts();
  
  const [authorizedRetailers, setAuthorizedRetailers] = useState([]);
  const [retailerApplications, setRetailerApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('authorized');

  // Load authorized retailers for the current brand
  const loadAuthorizedRetailers = async () => {
    if (!retailerRegistry || !account) return;
    
    try {
      setLoading(true);
      
      // Listen for RetailerAuthorized events where this account is the brand
      const filter = retailerRegistry.filters.RetailerAuthorized(account);
      const events = await retailerRegistry.queryFilter(filter);
      
      const retailers = await Promise.all(events.map(async (event) => {
        const retailerAddress = event.args.retailer;
        const retailerInfo = await retailerRegistry.retailers(retailerAddress);
        const reputation = await retailerRegistry.getReputationScore(retailerAddress);
        
        return {
          address: retailerAddress,
          name: retailerInfo.name,
          location: retailerInfo.location,
          contactInfo: retailerInfo.contactInfo,
          volume: retailerInfo.volume.toString(),
          disputeCount: retailerInfo.disputeCount.toString(),
          avgResponseTime: retailerInfo.avgResponseTime.toString(),
          reputationScore: reputation.toString(),
          isActive: retailerInfo.isActive,
          authorizedAt: new Date(Number(event.args.timestamp || 0) * 1000)
        };
      }));
      
      setAuthorizedRetailers(retailers);
    } catch (error) {
      console.error('Error loading authorized retailers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load pending retailer applications
  const loadRetailerApplications = async () => {
    if (!retailerRegistry || !account) return;
    
    try {
      setLoading(true);
      
      // Listen for RetailerRegistered events to find new retailers
      const filter = retailerRegistry.filters.RetailerRegistered();
      const events = await retailerRegistry.queryFilter(filter);
      
      const applications = await Promise.all(events.map(async (event) => {
        const retailerAddress = event.args.retailer;
        const isAuthorized = await retailerRegistry.isAuthorizedRetailer(account, retailerAddress);
        
        if (!isAuthorized) {
          const retailerInfo = await retailerRegistry.retailers(retailerAddress);
          return {
            address: retailerAddress,
            name: retailerInfo.name,
            location: retailerInfo.location,
            contactInfo: retailerInfo.contactInfo,
            registeredAt: new Date(Number(event.args.timestamp || 0) * 1000),
            isActive: retailerInfo.isActive
          };
        }
        return null;
      }));
      
      setRetailerApplications(applications.filter(app => app !== null));
    } catch (error) {
      console.error('Error loading retailer applications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Authorize a retailer
  const authorizeRetailer = async (retailerAddress) => {
    if (!retailerRegistry || !signer) return;
    
    try {
      setLoading(true);
      const tx = await retailerRegistry.authorizeRetailer(retailerAddress);
      await tx.wait();
      
      alert('Retailer authorized successfully!');
      loadAuthorizedRetailers();
      loadRetailerApplications();
    } catch (error) {
      console.error('Error authorizing retailer:', error);
      alert('Authorization failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Revoke retailer authorization
  const revokeRetailer = async (retailerAddress) => {
    if (!retailerRegistry || !signer) return;
    
    if (!window.confirm('Are you sure you want to revoke authorization for this retailer?')) {
      return;
    }
    
    try {
      setLoading(true);
      const tx = await retailerRegistry.revokeRetailer(retailerAddress);
      await tx.wait();
      
      alert('Retailer authorization revoked successfully!');
      loadAuthorizedRetailers();
    } catch (error) {
      console.error('Error revoking retailer:', error);
      alert('Revocation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account && retailerRegistry) {
      loadAuthorizedRetailers();
      loadRetailerApplications();
    }
  }, [account, retailerRegistry]);

  const getReputationColor = (score) => {
    const numScore = parseInt(score);
    if (numScore >= 800) return 'text-green-600 bg-green-100';
    if (numScore >= 600) return 'text-yellow-600 bg-yellow-100';
    if (numScore >= 400) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const tabs = [
    { id: 'authorized', label: 'Authorized Retailers', icon: '✅', count: authorizedRetailers.length },
    { id: 'applications', label: 'Pending Applications', icon: '⏳', count: retailerApplications.length }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">🏪 Retailer Registry</h2>
        <p className="text-gray-600">Retailer Authorization Status - The Retailer Report Card</p>
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
            {tab.count > 0 && (
              <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner message="Loading retailers..." />}

      {/* Authorized Retailers Tab */}
      {activeTab === 'authorized' && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Retailers Authorized by Your Brand
            </h3>
            <Button 
              variant="secondary" 
              onClick={loadAuthorizedRetailers}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
          
          {authorizedRetailers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No authorized retailers yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Retailer</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Reputation Score</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Volume</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Disputes</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {authorizedRetailers.map((retailer, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{retailer.name}</div>
                          <div className="text-xs text-gray-500 font-mono">
                            {retailer.address.slice(0, 6)}...{retailer.address.slice(-4)}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{retailer.location}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReputationColor(retailer.reputationScore)}`}>
                          {retailer.reputationScore}/1000
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{retailer.volume}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{retailer.disputeCount}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          retailer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {retailer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => revokeRetailer(retailer.address)}
                          disabled={loading}
                        >
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Pending Applications Tab */}
      {activeTab === 'applications' && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Pending Retailer Applications
            </h3>
            <Button 
              variant="secondary" 
              onClick={loadRetailerApplications}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
          
          {retailerApplications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending applications
            </div>
          ) : (
            <div className="space-y-4">
              {retailerApplications.map((application, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-2">{application.name}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Address:</span>
                          <div className="font-mono">{application.address}</div>
                        </div>
                        <div>
                          <span className="font-medium">Location:</span>
                          <div>{application.location}</div>
                        </div>
                        <div>
                          <span className="font-medium">Contact:</span>
                          <div>{application.contactInfo}</div>
                        </div>
                        <div>
                          <span className="font-medium">Registered:</span>
                          <div>{application.registeredAt.toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex space-x-2">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => authorizeRetailer(application.address)}
                        disabled={loading}
                      >
                        Authorize
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Brand Info */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Brand Information</h3>
        <div className="text-sm text-gray-600">
          <p><span className="font-medium">Brand Address:</span> {account}</p>
          <p className="mt-1">Retailers authorized by this brand will be able to receive product transfers.</p>
        </div>
      </Card>
    </div>
  );
};

export default RetailerRegistryPanel;
