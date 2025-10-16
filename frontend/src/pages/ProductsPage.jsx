import React, { useState, useEffect } from 'react';
import { AiOutlinePlus, AiOutlineSearch, AiOutlineFilter } from 'react-icons/ai';
import Card from '../components/Common/Card';
import Button from '../components/Common/Button';
import Modal from '../components/Common/Modal';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { useProductRegistry } from '../hooks/useContracts';
import { useWallet } from '../contexts/WalletContext';
import { ButtonVariants, PRODUCT_STATUS_LABELS } from '../types';

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: '',
    origin: '',
    metadataURI: ''
  });

  const { registerProduct, getProduct } = useProductRegistry();
  const { account, isConnected } = useWallet();

  // Mock data for demonstration - replace with actual contract calls
  const mockProducts = [
    {
      id: '0x123...',
      name: 'Premium Coffee Beans',
      description: 'Ethiopian single-origin coffee beans',
      category: 'Food & Beverage',
      status: 0, // REGISTERED
      manufacturer: '0xabc...',
      registeredAt: Date.now() - 86400000, // 1 day ago
      isVerified: true
    },
    {
      id: '0x456...',
      name: 'Organic Cotton T-Shirt',
      description: 'Sustainably sourced organic cotton apparel',
      category: 'Clothing',
      status: 2, // AT_RETAILER
      manufacturer: '0xdef...',
      registeredAt: Date.now() - 172800000, // 2 days ago
      isVerified: true
    },
    {
      id: '0x789...',
      name: 'Artisan Leather Wallet',
      description: 'Handcrafted genuine leather wallet',
      category: 'Accessories',
      status: 1, // IN_TRANSIT
      manufacturer: '0xghi...',
      registeredAt: Date.now() - 259200000, // 3 days ago
      isVerified: false
    }
  ];

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, statusFilter]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      // For now, use mock data
      // TODO: Replace with actual contract calls when ABIs are available
      setProducts(mockProducts);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(product => 
        product.status === parseInt(statusFilter)
      );
    }

    setFilteredProducts(filtered);
  };

  const handleRegisterProduct = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      const productId = `0x${Date.now().toString(16)}`; // Generate a simple ID
      const productData = {
        productId,
        metadataURI: newProduct.metadataURI || `ipfs://example-hash-${Date.now()}`
      };

      // TODO: Uncomment when contract is available
      // const result = await registerProduct(productData);
      // if (result?.success) {
      //   loadProducts();
      //   setShowRegisterModal(false);
      //   setNewProduct({ name: '', description: '', category: '', origin: '', metadataURI: '' });
      // }

      // For demo purposes, add to mock data
      const newMockProduct = {
        id: productId,
        name: newProduct.name,
        description: newProduct.description,
        category: newProduct.category,
        status: 0, // REGISTERED
        manufacturer: account,
        registeredAt: Date.now(),
        isVerified: false
      };
      
      setProducts(prev => [newMockProduct, ...prev]);
      setShowRegisterModal(false);
      setNewProduct({ name: '', description: '', category: '', origin: '', metadataURI: '' });
    } catch (error) {
      console.error('Error registering product:', error);
    }
  };

  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 0: return 'bg-blue-100 text-blue-800'; // REGISTERED
      case 1: return 'bg-yellow-100 text-yellow-800'; // IN_TRANSIT
      case 2: return 'bg-green-100 text-green-800'; // AT_RETAILER
      case 3: return 'bg-gray-100 text-gray-800'; // SOLD
      case 4: return 'bg-red-100 text-red-800'; // DISPUTED
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="pt-20 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Registry</h1>
        <p className="text-gray-600">Manage and track your registered products</p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <AiOutlineSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <AiOutlineFilter className="text-gray-400" size={20} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-48"
          >
            <option value="all">All Status</option>
            <option value="0">Registered</option>
            <option value="1">In Transit</option>
            <option value="2">At Retailer</option>
            <option value="3">Sold</option>
            <option value="4">Disputed</option>
          </select>
        </div>

        {/* Register Button */}
        <Button
          variant={ButtonVariants.PRIMARY}
          onClick={() => setShowRegisterModal(true)}
          className="flex items-center gap-2"
        >
          <AiOutlinePlus size={20} />
          Register Product
        </Button>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner message="Loading products..." />
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-600 mb-4">
            {products.length === 0 
              ? "You haven't registered any products yet." 
              : "No products match your current filters."
            }
          </p>
          {products.length === 0 && (
            <Button
              variant={ButtonVariants.PRIMARY}
              onClick={() => setShowRegisterModal(true)}
            >
              Register Your First Product
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} hover className="relative">
              {/* Verification Badge */}
              {product.isVerified && (
                <div className="absolute top-4 right-4 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                  Verified
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {product.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">
                    {product.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Category:</span>
                    <span className="font-medium">{product.category}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(product.status)}`}>
                      {PRODUCT_STATUS_LABELS[product.status]}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Manufacturer:</span>
                    <span className="font-medium">{formatAddress(product.manufacturer)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Registered:</span>
                    <span className="font-medium">{formatDate(product.registeredAt)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <Button
                    variant={ButtonVariants.SECONDARY}
                    onClick={() => {/* TODO: Navigate to product details */}}
                    className="w-full"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Register Product Modal */}
      <Modal
        open={showRegisterModal}
        title="Register New Product"
        onClose={() => setShowRegisterModal(false)}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Name *
            </label>
            <input
              type="text"
              value={newProduct.name}
              onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
              className="input-field"
              placeholder="Enter product name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={newProduct.description}
              onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="input-field"
              placeholder="Describe your product"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={newProduct.category}
                onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
                className="input-field"
                required
              >
                <option value="">Select category</option>
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Clothing">Clothing</option>
                <option value="Electronics">Electronics</option>
                <option value="Accessories">Accessories</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Origin
              </label>
              <input
                type="text"
                value={newProduct.origin}
                onChange={(e) => setNewProduct(prev => ({ ...prev, origin: e.target.value }))}
                className="input-field"
                placeholder="Country/region of origin"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Metadata URI
            </label>
            <input
              type="text"
              value={newProduct.metadataURI}
              onChange={(e) => setNewProduct(prev => ({ ...prev, metadataURI: e.target.value }))}
              className="input-field"
              placeholder="IPFS hash or URL (optional)"
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave empty to auto-generate metadata
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant={ButtonVariants.SECONDARY}
              onClick={() => setShowRegisterModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariants.PRIMARY}
              onClick={handleRegisterProduct}
              disabled={!newProduct.name || !newProduct.description || !newProduct.category}
            >
              Register Product
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductsPage;
