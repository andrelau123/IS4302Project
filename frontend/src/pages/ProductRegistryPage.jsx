import React, { useState, useEffect } from 'react';
import { Card } from '../components/Common/Card';
import { Button } from '../components/Common/Button';
import { useWallet } from '../contexts/WalletContext';
import { useContracts } from '../hooks/useContracts';

const ProductRegistryPage = () => {
  const { isConnected, signer } = useWallet();
  const { productRegistry } = useContracts();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newProduct, setNewProduct] = useState({
    productId: '',
    metadataURI: ''
  });

  const loadProducts = async () => {
    try {
      setLoading(true);
      // Load products from contract
      // Implementation depends on your contract's structure
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const registerProduct = async (e) => {
    e.preventDefault();
    if (!productRegistry || !signer) return;

    try {
      setLoading(true);
      const tx = await productRegistry.registerProduct(
        newProduct.productId,
        newProduct.metadataURI
      );
      await tx.wait();
      
      setNewProduct({ productId: '', metadataURI: '' });
      loadProducts();
    } catch (error) {
      console.error('Error registering product:', error);
      alert('Failed to register product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && productRegistry) {
      loadProducts();
    }
  }, [isConnected, productRegistry]);

  if (!isConnected) {
    return (
      <div className="pt-20 p-6 max-w-7xl mx-auto">
        <Card className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Product Registry - The Digital Inventory and Passport
          </h2>
          <p className="text-gray-600 mb-6">
            Please connect your wallet to access the Product Registry
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="pt-20 p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          📦 Product Registry
        </h1>
        <p className="text-xl text-gray-600 mb-4">
          The Digital Inventory and Passport
        </p>
        <p className="text-gray-700">
          The main database that tracks every authentic item. It records who made it, who owns it now, 
          where it is in the supply chain (Status), and its history (transfers).
        </p>
      </div>

      {/* Key Users */}
      <Card className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Users</h3>
        <div className="flex gap-2 flex-wrap">
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
            Manufacturers
          </span>
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
            Retailers
          </span>
          <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
            Verifiers
          </span>
        </div>
      </Card>

      {/* Register New Product */}
      <Card className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Register New Product</h3>
        <form onSubmit={registerProduct} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product ID
            </label>
            <input
              type="text"
              value={newProduct.productId}
              onChange={(e) => setNewProduct({...newProduct, productId: e.target.value})}
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
              value={newProduct.metadataURI}
              onChange={(e) => setNewProduct({...newProduct, metadataURI: e.target.value})}
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

      {/* Product List */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Registered Products</h3>
          <Button variant="secondary" onClick={loadProducts} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
        
        {products.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No products registered yet
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Product ID: {product.productId}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Manufacturer: {product.manufacturer}
                    </p>
                    <p className="text-sm text-gray-600">
                      Status: {product.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">
                      Registered: {new Date(product.registeredAt * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProductRegistryPage;
