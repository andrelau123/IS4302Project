import React, { useState, useEffect } from 'react';
import { AiOutlineShoppingCart, AiOutlineHeart, AiOutlineVerified } from 'react-icons/ai';
import { MdVerified } from 'react-icons/md';
import Card from '../components/Common/Card';
import Button from '../components/Common/Button';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { useProductNFT } from '../hooks/useContracts';
import { useWallet } from '../contexts/WalletContext';
import { ButtonVariants } from '../types';

const MarketplacePage = () => {
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priceSort, setPriceSort] = useState('none');

  const { getUserNFTs } = useProductNFT();
  const { account, isConnected } = useWallet();

  // Mock marketplace data
  const mockListings = [
    {
      id: '1',
      tokenId: '101',
      name: 'Premium Coffee Beans NFT',
      description: 'Authentic Ethiopian single-origin coffee beans with blockchain verification',
      price: '0.5',
      currency: 'ETH',
      image: '/api/placeholder/300/300',
      seller: '0xabc123...',
      isVerified: true,
      category: 'Food & Beverage',
      rarity: 'Rare',
      likes: 45,
      views: 234
    },
    {
      id: '2',
      tokenId: '102',
      name: 'Organic Cotton T-Shirt NFT',
      description: 'Sustainably sourced organic cotton apparel with authenticity guarantee',
      price: '0.3',
      currency: 'ETH',
      image: '/api/placeholder/300/300',
      seller: '0xdef456...',
      isVerified: true,
      category: 'Clothing',
      rarity: 'Common',
      likes: 23,
      views: 156
    },
    {
      id: '3',
      tokenId: '103',
      name: 'Artisan Leather Wallet NFT',
      description: 'Handcrafted genuine leather wallet with provenance tracking',
      price: '0.8',
      currency: 'ETH',
      image: '/api/placeholder/300/300',
      seller: '0xghi789...',
      isVerified: true,
      category: 'Accessories',
      rarity: 'Epic',
      likes: 67,
      views: 445
    },
    {
      id: '4',
      tokenId: '104',
      name: 'Handmade Ceramic Mug NFT',
      description: 'Unique ceramic mug with artist authenticity certificate',
      price: '0.2',
      currency: 'ETH',
      image: '/api/placeholder/300/300',
      seller: '0xjkl012...',
      isVerified: false,
      category: 'Art & Crafts',
      rarity: 'Common',
      likes: 12,
      views: 89
    }
  ];

  useEffect(() => {
    loadListings();
  }, []);

  useEffect(() => {
    filterAndSortListings();
  }, [listings, searchTerm, categoryFilter, priceSort]);

  const loadListings = async () => {
    setIsLoading(true);
    try {
      // For now, use mock data
      // TODO: Replace with actual marketplace contract calls
      setListings(mockListings);
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortListings = () => {
    let filtered = [...listings];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(listing =>
        listing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(listing => 
        listing.category === categoryFilter
      );
    }

    // Price sorting
    if (priceSort !== 'none') {
      filtered.sort((a, b) => {
        const priceA = parseFloat(a.price);
        const priceB = parseFloat(b.price);
        return priceSort === 'low' ? priceA - priceB : priceB - priceA;
      });
    }

    setFilteredListings(filtered);
  };

  const handlePurchase = async (listing) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    // TODO: Implement purchase logic
    console.log('Purchasing:', listing);
    alert(`Purchase functionality for ${listing.name} will be implemented when contracts are ready`);
  };

  const handleLike = (listingId) => {
    setListings(prev => prev.map(listing => 
      listing.id === listingId 
        ? { ...listing, likes: listing.likes + 1 }
        : listing
    ));
  };

  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const getRarityColor = (rarity) => {
    switch (rarity.toLowerCase()) {
      case 'common': return 'text-gray-600';
      case 'rare': return 'text-blue-600';
      case 'epic': return 'text-purple-600';
      case 'legendary': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const categories = ['All', 'Food & Beverage', 'Clothing', 'Electronics', 'Accessories', 'Art & Crafts'];

  return (
    <div className="pt-20 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">NFT Marketplace</h1>
        <p className="text-gray-600">Discover and collect authenticated product NFTs</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search NFTs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-field w-48"
        >
          <option value="all">All Categories</option>
          {categories.slice(1).map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>

        {/* Price Sort */}
        <select
          value={priceSort}
          onChange={(e) => setPriceSort(e.target.value)}
          className="input-field w-48"
        >
          <option value="none">Sort by Price</option>
          <option value="low">Price: Low to High</option>
          <option value="high">Price: High to Low</option>
        </select>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <div className="text-2xl font-bold text-primary-blue">{listings.length}</div>
          <div className="text-sm text-gray-600">Total NFTs</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-primary-green">
            {listings.filter(l => l.isVerified).length}
          </div>
          <div className="text-sm text-gray-600">Verified</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-primary-purple">
            {listings.reduce((sum, l) => sum + l.likes, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Likes</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-accent-orange">
            {listings.reduce((sum, l) => sum + l.views, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Views</div>
        </Card>
      </div>

      {/* Listings Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner message="Loading marketplace..." />
        </div>
      ) : filteredListings.length === 0 ? (
        <Card className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No NFTs found</h3>
          <p className="text-gray-600">
            {listings.length === 0 
              ? "No NFTs are currently listed in the marketplace." 
              : "No NFTs match your current filters."
            }
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredListings.map((listing) => (
            <Card key={listing.id} hover className="relative overflow-hidden">
              {/* Verification Badge */}
              {listing.isVerified && (
                <div className="absolute top-4 right-4 z-10 bg-green-500 text-white p-1 rounded-full">
                  <MdVerified size={16} />
                </div>
              )}

              {/* NFT Image */}
              <div className="aspect-square bg-gray-200 rounded-lg mb-4 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  <AiOutlineVerified size={48} />
                </div>
                {/* Replace with actual image when available */}
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs">
                  #{listing.tokenId}
                </div>
              </div>

              {/* NFT Details */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1 truncate">
                    {listing.name}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {listing.description}
                  </p>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Rarity:</span>
                  <span className={`font-medium ${getRarityColor(listing.rarity)}`}>
                    {listing.rarity}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Seller:</span>
                  <span className="font-medium">{formatAddress(listing.seller)}</span>
                </div>

                {/* Price and Actions */}
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {listing.price} {listing.currency}
                      </div>
                      <div className="text-xs text-gray-500">
                        ≈ ${(parseFloat(listing.price) * 2000).toFixed(0)} USD
                      </div>
                    </div>
                    <button
                      onClick={() => handleLike(listing.id)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <AiOutlineHeart size={20} className="text-gray-400 hover:text-red-500" />
                      <span className="sr-only">Like</span>
                    </button>
                  </div>

                  <Button
                    variant={ButtonVariants.PRIMARY}
                    onClick={() => handlePurchase(listing)}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <AiOutlineShoppingCart size={18} />
                    Buy Now
                  </Button>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{listing.likes} likes</span>
                  <span>{listing.views} views</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketplacePage;
