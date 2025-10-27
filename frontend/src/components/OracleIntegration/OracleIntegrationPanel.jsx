import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../Common/Card';
import { Button } from '../Common/Button';
import LoadingSpinner from '../Common/LoadingSpinner';
import { useWallet } from '../../contexts/WalletContext';
import { useContracts } from '../../hooks/useContracts';
import { ethers } from 'ethers';

const OracleIntegrationPanel = () => {
  const { account, signer } = useWallet();
  const { oracleIntegration } = useContracts();
  
  const [priceFeeds, setPriceFeeds] = useState([]);
  const [oracleData, setOracleData] = useState([]);
  const [userRole, setUserRole] = useState('none');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('feeds');
  const [newPriceFeed, setNewPriceFeed] = useState({
    symbol: '',
    price: '',
    decimals: '18'
  });

  // Load price feeds
  const loadPriceFeeds = useCallback(async () => {
    if (!oracleIntegration) return;
    
    try {
      setLoading(true);
      
      // Common trading pairs and assets
      const commonSymbols = ['ETH', 'BTC', 'USDC', 'USDT', 'LINK', 'MATIC', 'BNB', 'ADA', 'SOL', 'DOT'];
      const feedList = [];
      
      for (const symbol of commonSymbols) {
        try {
          const priceData = await oracleIntegration.getPrice(symbol);
          const lastUpdate = await oracleIntegration.getLastUpdate(symbol);
          const decimals = await oracleIntegration.getDecimals(symbol);
          
          const price = Number(ethers.formatUnits(priceData, Number(decimals)));
          const updateTime = new Date(Number(lastUpdate) * 1000);
          const timeSinceUpdate = Math.floor((Date.now() - updateTime.getTime()) / 1000);
          
          // Calculate reliability based on update frequency
          const maxAge = 3600; // 1 hour
          const reliability = Math.max(0, Math.min(100, 100 - (timeSinceUpdate / maxAge) * 100));
          
          feedList.push({
            symbol,
            price,
            decimals: Number(decimals),
            lastUpdate: updateTime,
            timeSinceUpdate,
            reliability: Math.round(reliability),
            isStale: timeSinceUpdate > maxAge,
            priceFormatted: price.toFixed(price < 1 ? 6 : 2)
          });
        } catch (error) {
          // If price doesn't exist, skip it
          console.log(`No price data for ${symbol}`);
        }
      }
      
      setPriceFeeds(feedList);
    } catch (error) {
      console.error('Error loading price feeds:', error);
    } finally {
      setLoading(false);
    }
  }, [oracleIntegration]);

  // Load oracle data and events
  const loadOracleData = useCallback(async () => {
    if (!oracleIntegration) return;
    
    try {
      setLoading(true);
      
      // Get oracle events and data updates
      // This would typically involve listening to events or getting historical data
      const dataList = [];
      
      // Mock some oracle data updates for demo
      for (let i = 0; i < 10; i++) {
        dataList.push({
          id: i + 1,
          type: 'Price Update',
          symbol: ['ETH', 'BTC', 'USDC'][i % 3],
          value: (Math.random() * 1000 + 100).toFixed(2),
          timestamp: new Date(Date.now() - i * 60000), // Last 10 minutes
          source: 'Chainlink',
          status: Math.random() > 0.1 ? 'Verified' : 'Pending'
        });
      }
      
      setOracleData(dataList);
    } catch (error) {
      console.error('Error loading oracle data:', error);
    } finally {
      setLoading(false);
    }
  }, [oracleIntegration]);

  // Check user role (oracle admin)
  const checkUserRole = useCallback(async () => {
    if (!oracleIntegration || !account) return;
    
    try {
      // Check if user has admin role or is an oracle operator
      const hasRole = await oracleIntegration.hasRole(
        await oracleIntegration.ORACLE_ROLE(),
        account
      );
      setUserRole(hasRole ? 'oracle' : 'user');
    } catch (error) {
      console.error('Error checking user role:', error);
      setUserRole('user');
    }
  }, [oracleIntegration, account]);

  // Update price feed (oracle only)
  const updatePrice = async (e) => {
    e.preventDefault();
    if (!oracleIntegration || !signer) return;
    
    try {
      setLoading(true);
      const priceInWei = ethers.parseUnits(newPriceFeed.price, parseInt(newPriceFeed.decimals));
      const tx = await oracleIntegration.updatePrice(
        newPriceFeed.symbol,
        priceInWei,
        parseInt(newPriceFeed.decimals)
      );
      await tx.wait();
      
      alert(`Price for ${newPriceFeed.symbol} updated successfully!`);
      setNewPriceFeed({ symbol: '', price: '', decimals: '18' });
      loadPriceFeeds();
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Price update failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Request price update
  const requestPriceUpdate = async (symbol) => {
    if (!oracleIntegration || !signer) return;
    
    try {
      setLoading(true);
      const tx = await oracleIntegration.requestPriceUpdate(symbol);
      await tx.wait();
      
      alert(`Price update requested for ${symbol}!`);
      loadOracleData();
    } catch (error) {
      console.error('Error requesting price update:', error);
      alert('Price update request failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (oracleIntegration) {
      loadPriceFeeds();
      loadOracleData();
      if (account) {
        checkUserRole();
      }
    }
  }, [oracleIntegration, account, loadPriceFeeds, loadOracleData, checkUserRole]);

  const getReliabilityColor = (reliability) => {
    if (reliability >= 80) return 'text-green-600';
    if (reliability >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getReliabilityBadge = (reliability) => {
    if (reliability >= 80) return 'bg-green-100 text-green-800';
    if (reliability >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getTimeSinceUpdate = (seconds) => {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const tabs = [
    { id: 'feeds', label: 'Price Feeds', icon: '📊', count: priceFeeds.length },
    { id: 'data', label: 'Oracle Data', icon: '🔮', count: oracleData.length },
    { id: 'analytics', label: 'Analytics', icon: '📈' }
  ];

  // Add oracle management tab if user is an oracle
  if (userRole === 'oracle') {
    tabs.push({ id: 'manage', label: 'Manage Oracle', icon: '⚙️' });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">🔮 Oracle Integration</h2>
        <p className="text-gray-600">The Data Prophet (External Data Feeds)</p>
        <div className="mt-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            userRole === 'oracle' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {userRole === 'oracle' ? '🔮 Oracle Operator' : '👤 User'}
          </span>
        </div>
      </div>

      {/* System Status */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{priceFeeds.length}</div>
            <div className="text-sm text-gray-600">Active Feeds</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {priceFeeds.filter(f => !f.isStale).length}
            </div>
            <div className="text-sm text-gray-600">Fresh Data</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {priceFeeds.filter(f => f.isStale).length}
            </div>
            <div className="text-sm text-gray-600">Stale Data</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {priceFeeds.length > 0 ? Math.round(priceFeeds.reduce((sum, f) => sum + f.reliability, 0) / priceFeeds.length) : 0}%
            </div>
            <div className="text-sm text-gray-600">Avg Reliability</div>
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

      {loading && <LoadingSpinner message="Loading oracle data..." />}

      {/* Price Feeds Tab */}
      {activeTab === 'feeds' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Price Feeds</h3>
            <Button variant="secondary" onClick={loadPriceFeeds} disabled={loading}>
              Refresh Feeds
            </Button>
          </div>
          
          {priceFeeds.length === 0 ? (
            <Card>
              <div className="text-center py-8 text-gray-500">
                No price feeds available
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {priceFeeds.map((feed) => (
                <Card key={feed.symbol}>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{feed.symbol}</h4>
                        <div className="text-2xl font-bold text-blue-600">${feed.priceFormatted}</div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReliabilityBadge(feed.reliability)}`}>
                        {feed.reliability}% reliable
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Last Update:</span> {getTimeSinceUpdate(feed.timeSinceUpdate)}</p>
                      <p><span className="font-medium">Decimals:</span> {feed.decimals}</p>
                      <p><span className="font-medium">Status:</span> 
                        <span className={`ml-1 ${feed.isStale ? 'text-red-600' : 'text-green-600'}`}>
                          {feed.isStale ? 'Stale' : 'Fresh'}
                        </span>
                      </p>
                    </div>

                    {feed.isStale && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => requestPriceUpdate(feed.symbol)}
                        disabled={loading}
                        className="w-full"
                      >
                        Request Update
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Oracle Data Tab */}
      {activeTab === 'data' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Recent Oracle Data Updates</h3>
            <Button variant="secondary" onClick={loadOracleData} disabled={loading}>
              Refresh Data
            </Button>
          </div>
          
          {oracleData.length === 0 ? (
            <Card>
              <div className="text-center py-8 text-gray-500">
                No oracle data updates
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {oracleData.map((data) => (
                <Card key={data.id}>
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-gray-900">{data.type}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          data.status === 'Verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {data.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">{data.symbol}</span> → ${data.value} 
                        <span className="ml-2 text-gray-500">from {data.source}</span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {data.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Oracle Performance Analytics</h3>
          
          {/* Reliability Chart */}
          <Card>
            <h4 className="font-medium text-gray-900 mb-4">Feed Reliability Overview</h4>
            <div className="space-y-3">
              {priceFeeds.map((feed) => (
                <div key={feed.symbol} className="flex items-center">
                  <div className="w-16 text-sm font-medium text-gray-700">{feed.symbol}</div>
                  <div className="flex-1 mx-4">
                    <div className="bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          feed.reliability >= 80 ? 'bg-green-500' :
                          feed.reliability >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${feed.reliability}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className={`w-12 text-sm font-medium ${getReliabilityColor(feed.reliability)}`}>
                    {feed.reliability}%
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Update Frequency */}
          <Card>
            <h4 className="font-medium text-gray-900 mb-4">Update Frequency</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {priceFeeds.filter(f => f.timeSinceUpdate < 300).length}
                </div>
                <div className="text-sm text-gray-600">Fresh (&lt; 5m)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {priceFeeds.filter(f => f.timeSinceUpdate >= 300 && f.timeSinceUpdate < 3600).length}
                </div>
                <div className="text-sm text-gray-600">Moderate (5m-1h)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {priceFeeds.filter(f => f.timeSinceUpdate >= 3600).length}
                </div>
                <div className="text-sm text-gray-600">Stale (&gt; 1h)</div>
              </div>
            </div>
          </Card>

          {/* Price Volatility */}
          <Card>
            <h4 className="font-medium text-gray-900 mb-4">Price Ranges (Last 24h)</h4>
            <div className="space-y-3">
              {priceFeeds.slice(0, 5).map((feed) => {
                const variation = Math.random() * 10; // Mock variation
                const isPositive = Math.random() > 0.5;
                return (
                  <div key={feed.symbol} className="flex justify-between items-center">
                    <div className="font-medium text-gray-900">{feed.symbol}</div>
                    <div className="text-right">
                      <div className="font-medium">${feed.priceFormatted}</div>
                      <div className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : '-'}{variation.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Manage Oracle Tab */}
      {activeTab === 'manage' && userRole === 'oracle' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Oracle Management</h3>
          
          {/* Update Price Feed */}
          <Card>
            <h4 className="font-medium text-gray-900 mb-4">Update Price Feed</h4>
            <form onSubmit={updatePrice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Symbol
                </label>
                <input
                  type="text"
                  value={newPriceFeed.symbol}
                  onChange={(e) => setNewPriceFeed({...newPriceFeed, symbol: e.target.value.toUpperCase()})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., ETH, BTC, USDC"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (USD)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={newPriceFeed.price}
                  onChange={(e) => setNewPriceFeed({...newPriceFeed, price: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 2000.50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Decimals
                </label>
                <select
                  value={newPriceFeed.decimals}
                  onChange={(e) => setNewPriceFeed({...newPriceFeed, decimals: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="18">18 (Standard)</option>
                  <option value="8">8 (BTC/USD)</option>
                  <option value="6">6 (USDC)</option>
                </select>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update Price'}
              </Button>
            </form>
          </Card>

          {/* Oracle Controls */}
          <Card>
            <h4 className="font-medium text-gray-900 mb-4">Oracle Status</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">Active</div>
                  <div className="text-sm text-gray-600">Oracle Status</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{priceFeeds.length}</div>
                  <div className="text-sm text-gray-600">Managed Feeds</div>
                </div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h5 className="font-medium text-purple-900 mb-2">Oracle Responsibilities</h5>
                <ul className="text-sm text-purple-800 space-y-1">
                  <li>• Provide accurate and timely price data</li>
                  <li>• Monitor feed reliability and update frequency</li>
                  <li>• Respond to price update requests promptly</li>
                  <li>• Maintain data integrity and security</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OracleIntegrationPanel;
