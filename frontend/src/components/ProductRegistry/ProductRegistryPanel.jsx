import React, { useState, useEffect } from 'react';
import { Card } from '../Common/Card';
import { Button } from '../Common/Button';
import LoadingSpinner from '../Common/LoadingSpinner';
import { useWallet } from '../../contexts/WalletContext';
import { useContracts } from '../../hooks/useContracts';
import { ethers } from 'ethers';

const ProductRegistryPanel = () => {
  const { account, signer } = useWallet();
  const { productRegistry, retailerRegistry } = useContracts();
  
  // State management
  const [manufacturerProducts, setManufacturerProducts] = useState([]);
  const [selectedProductHistory, setSelectedProductHistory] = useState(null);
  const [productHistory, setProductHistory] = useState([]);
  const [transferForm, setTransferForm] = useState({
    productId: '',
    toAddress: '',
    location: ''
  });
  const [retailerWarning, setRetailerWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('products');

  // Load manufacturer's products
  const loadManufacturerProducts = async () => {
    if (!productRegistry || !account) return;
    
    try {
      setLoading(true);
      // Listen for ProductRegistered events from this manufacturer
      const filter = productRegistry.filters.ProductRegistered(null, account);
      const events = await productRegistry.queryFilter(filter);
      
      const products = await Promise.all(events.map(async (event) => {
        const productId = event.args.productId;
        const product = await productRegistry.products(productId);
        return {
          productId: productId,
          status: ['Registered', 'InTransit', 'AtRetailer', 'Sold', 'Disputed'][product.status],
          currentOwner: product.currentOwner,
          registeredAt: new Date(Number(product.registeredAt) * 1000),
          metadataURI: product.metadataURI,
          exists: product.exists
        };
      }));
      
      setManufacturerProducts(products);
    } catch (error) {
      console.error('Error loading manufacturer products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load product history
  const loadProductHistory = async (productId) => {
    if (!productRegistry || !productId) return;
    
    try {
      setLoading(true);
      const history = await productRegistry.getProductHistory(productId);
      
      const formattedHistory = history.map((event, index) => ({
        index,
        from: event.from,
        to: event.to,
        timestamp: new Date(Number(event.timestamp) * 1000),
        location: event.location,
        verificationHash: event.verificationHash
      }));
      
      setProductHistory(formattedHistory);
      setSelectedProductHistory(productId);
    } catch (error) {
      console.error('Error loading product history:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if address is authorized retailer
  const checkRetailerAuthorization = async (address) => {
    if (!retailerRegistry || !address || !ethers.isAddress(address)) {
      setRetailerWarning('');
      return;
    }
    
    try {
      const isAuthorized = await retailerRegistry.isAuthorizedRetailer(account, address);
      if (!isAuthorized) {
        setRetailerWarning('⚠️ WARNING: This address is not an authorized retailer for your brand!');
      } else {
        setRetailerWarning('✅ This retailer is authorized for your brand.');
      }
    } catch (error) {
      console.error('Error checking retailer authorization:', error);
      setRetailerWarning('❌ Unable to verify retailer authorization.');
    }
  };

  // Handle transfer
  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!productRegistry || !signer) return;
    
    try {
      setLoading(true);
      const tx = await productRegistry.transferProduct(
        transferForm.productId,
        transferForm.toAddress,
        transferForm.location
      );
      await tx.wait();
      
      alert('Product transferred successfully!');
      setTransferForm({ productId: '', toAddress: '', location: '' });
      setRetailerWarning('');
      loadManufacturerProducts();
    } catch (error) {
      console.error('Error transferring product:', error);
      alert('Transfer failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle register new product
  const [registerForm, setRegisterForm] = useState({
    productId: '',
    metadataURI: ''
  });

  const handleRegisterProduct = async (e) => {
    e.preventDefault();
    if (!productRegistry || !signer) return;
    
    try {
      setLoading(true);
      const tx = await productRegistry.registerProduct(
        registerForm.productId,
        registerForm.metadataURI
      );
      await tx.wait();
      
      alert('Product registered successfully!');
      setRegisterForm({ productId: '', metadataURI: '' });
      loadManufacturerProducts();
    } catch (error) {
      console.error('Error registering product:', error);
      alert('Registration failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account && productRegistry) {
      loadManufacturerProducts();
    }
  }, [account, productRegistry]);

  useEffect(() => {
    checkRetailerAuthorization(transferForm.toAddress);
  }, [transferForm.toAddress, account, retailerRegistry]);

  const tabs = [
    { id: 'products', label: 'My Products', icon: '📦' },
    { id: 'register', label: 'Register Product', icon: '➕' },
    { id: 'transfer', label: 'Transfer Product', icon: '🔄' },
    { id: 'history', label: 'Product History', icon: '📋' }
  ];

  return (
    <div className="space-y-6">
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
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner message="Loading..." />}

      {/* My Products Tab */}
      {activeTab === 'products' && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Manufacturer's List of Products
            </h3>
            <Button 
              variant="secondary" 
              onClick={loadManufacturerProducts}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
          
          {manufacturerProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No products registered yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Product ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Current Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Current Owner</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Registered At</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {manufacturerProducts.map((product, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-sm">{product.productId}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.status === 'Registered' ? 'bg-green-100 text-green-800' :
                          product.status === 'InTransit' ? 'bg-yellow-100 text-yellow-800' :
                          product.status === 'AtRetailer' ? 'bg-blue-100 text-blue-800' :
                          product.status === 'Sold' ? 'bg-purple-100 text-purple-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-sm">
                        {product.currentOwner.slice(0, 6)}...{product.currentOwner.slice(-4)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {product.registeredAt.toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => loadProductHistory(product.productId)}
                        >
                          View History
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

      {/* Register Product Tab */}
      {activeTab === 'register' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Register New Product</h3>
          <form onSubmit={handleRegisterProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product ID
              </label>
              <input
                type="text"
                value={registerForm.productId}
                onChange={(e) => setRegisterForm({...registerForm, productId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter unique product ID"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Metadata URI
              </label>
              <input
                type="text"
                value={registerForm.metadataURI}
                onChange={(e) => setRegisterForm({...registerForm, metadataURI: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="IPFS hash or metadata URL"
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Registering...' : 'Register Product'}
            </Button>
          </form>
        </Card>
      )}

      {/* Transfer Product Tab */}
      {activeTab === 'transfer' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transfer Product</h3>
          <form onSubmit={handleTransfer} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product ID
              </label>
              <input
                type="text"
                value={transferForm.productId}
                onChange={(e) => setTransferForm({...transferForm, productId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter product ID"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={transferForm.toAddress}
                onChange={(e) => setTransferForm({...transferForm, toAddress: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0x..."
                required
              />
              {retailerWarning && (
                <div className={`mt-2 p-3 rounded-md text-sm ${
                  retailerWarning.includes('WARNING') ? 'bg-red-50 text-red-700 border border-red-200' :
                  retailerWarning.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' :
                  'bg-yellow-50 text-yellow-700 border border-yellow-200'
                }`}>
                  {retailerWarning}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location/Checkpoint
              </label>
              <input
                type="text"
                value={transferForm.location}
                onChange={(e) => setTransferForm({...transferForm, location: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Physical location or checkpoint"
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Transferring...' : 'Transfer Product'}
            </Button>
          </form>
        </Card>
      )}

      {/* Product History Tab */}
      {activeTab === 'history' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Product History Log</h3>
          
          {!selectedProductHistory ? (
            <div className="text-center py-8 text-gray-500">
              Select a product from "My Products" tab to view its history
            </div>
          ) : (
            <div>
              <div className="mb-4 p-3 bg-blue-50 rounded-md">
                <h4 className="font-medium text-blue-900">
                  History for Product: {selectedProductHistory}
                </h4>
              </div>
              
              {productHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No transfer history found for this product
                </div>
              ) : (
                <div className="space-y-4">
                  {productHistory.map((event, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium text-gray-900">
                          Transfer #{event.index + 1}
                        </h5>
                        <span className="text-xs text-gray-500">
                          {event.timestamp.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">From:</span>
                          <div className="font-mono text-gray-600">
                            {event.from.slice(0, 6)}...{event.from.slice(-4)}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">To:</span>
                          <div className="font-mono text-gray-600">
                            {event.to.slice(0, 6)}...{event.to.slice(-4)}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Location:</span>
                          <div className="text-gray-600">{event.location}</div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Verification Hash:</span>
                          <div className="font-mono text-gray-600 text-xs">
                            {event.verificationHash}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default ProductRegistryPanel;
