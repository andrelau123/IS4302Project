import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../Common/Card';
import { Button } from '../Common/Button';
import LoadingSpinner from '../Common/LoadingSpinner';
import { useWallet } from '../../contexts/WalletContext';
import { useContracts } from '../../hooks/useContracts';
import { ethers } from 'ethers';

const ProductNFTPanel = () => {
  const { account, signer } = useWallet();
  const { productNFT, marketplace } = useContracts();
  
  const [nfts, setNfts] = useState([]);
  const [userRole, setUserRole] = useState('none');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('gallery');
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [transferForm, setTransferForm] = useState({
    tokenId: '',
    toAddress: ''
  });
  const [mintForm, setMintForm] = useState({
    productId: '',
    metadata: {
      name: '',
      description: '',
      image: '',
      attributes: []
    }
  });

  // Load user's NFTs
  const loadNFTs = useCallback(async () => {
    if (!productNFT || !account) return;
    
    try {
      setLoading(true);
      
      // Get user's token balance
      const balance = await productNFT.balanceOf(account);
      const nftList = [];
      
      for (let i = 0; i < Number(balance); i++) {
        try {
          const tokenId = await productNFT.tokenOfOwnerByIndex(account, i);
          const tokenURI = await productNFT.tokenURI(tokenId);
          const owner = await productNFT.ownerOf(tokenId);
          
          // Try to get product info if it's linked to a product
          let productInfo = null;
          try {
            productInfo = await productNFT.getProductInfo(tokenId);
          } catch (error) {
            // NFT might not be linked to a product
          }
          
          // Mock metadata for demo (in real app, this would be fetched from IPFS/URI)
          const metadata = {
            name: `Product NFT #${tokenId}`,
            description: `Authentic product certificate #${tokenId}`,
            image: `https://via.placeholder.com/300x300/6366f1/white?text=NFT%20${tokenId}`,
            attributes: [
              { trait_type: "Authenticity", value: "Verified" },
              { trait_type: "Rarity", value: ["Common", "Rare", "Epic", "Legendary"][Number(tokenId) % 4] },
              { trait_type: "Product Type", value: ["Electronics", "Fashion", "Art", "Sports"][Number(tokenId) % 4] }
            ]
          };
          
          // Get transfer history (mock data for demo)
          const transferHistory = [
            {
              from: '0x0000000000000000000000000000000000000000',
              to: owner,
              timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
              txHash: '0x' + Math.random().toString(16).substr(2, 64),
              type: 'Mint'
            }
          ];
          
          nftList.push({
            tokenId: Number(tokenId),
            owner,
            tokenURI,
            metadata,
            productInfo,
            transferHistory,
            isOwned: owner.toLowerCase() === account.toLowerCase()
          });
        } catch (error) {
          console.error(`Error loading NFT ${i}:`, error);
        }
      }
      
      setNfts(nftList);
    } catch (error) {
      console.error('Error loading NFTs:', error);
    } finally {
      setLoading(false);
    }
  }, [productNFT, account]);

  // Check user role
  const checkUserRole = useCallback(async () => {
    if (!productNFT || !account) return;
    
    try {
      const hasRole = await productNFT.hasRole(
        await productNFT.MINTER_ROLE(),
        account
      );
      setUserRole(hasRole ? 'minter' : 'user');
    } catch (error) {
      console.error('Error checking user role:', error);
      setUserRole('user');
    }
  }, [productNFT, account]);

  // Mint new NFT
  const mintNFT = async (e) => {
    e.preventDefault();
    if (!productNFT || !signer) return;
    
    try {
      setLoading(true);
      
      // Create metadata URI (in real app, this would be uploaded to IPFS)
      const metadataURI = `data:application/json;base64,${btoa(JSON.stringify(mintForm.metadata))}`;
      
      const tx = await productNFT.mint(
        account,
        parseInt(mintForm.productId),
        metadataURI
      );
      await tx.wait();
      
      alert('NFT minted successfully!');
      setMintForm({
        productId: '',
        metadata: {
          name: '',
          description: '',
          image: '',
          attributes: []
        }
      });
      loadNFTs();
    } catch (error) {
      console.error('Error minting NFT:', error);
      alert('Minting failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Transfer NFT
  const transferNFT = async (e) => {
    e.preventDefault();
    if (!productNFT || !signer) return;
    
    try {
      setLoading(true);
      const tx = await productNFT.transferFrom(
        account,
        transferForm.toAddress,
        parseInt(transferForm.tokenId)
      );
      await tx.wait();
      
      alert('NFT transferred successfully!');
      setTransferForm({ tokenId: '', toAddress: '' });
      loadNFTs();
    } catch (error) {
      console.error('Error transferring NFT:', error);
      alert('Transfer failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // List NFT on marketplace
  const listOnMarketplace = async (tokenId, price) => {
    if (!marketplace || !signer) return;
    
    try {
      setLoading(true);
      
      // First approve marketplace to handle the NFT
      const approveTx = await productNFT.approve(marketplace.target, tokenId);
      await approveTx.wait();
      
      // List on marketplace
      const priceInWei = ethers.parseEther(price);
      const listTx = await marketplace.listItem(tokenId, priceInWei);
      await listTx.wait();
      
      alert('NFT listed on marketplace successfully!');
      loadNFTs();
    } catch (error) {
      console.error('Error listing NFT:', error);
      alert('Listing failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productNFT && account) {
      loadNFTs();
      checkUserRole();
    }
  }, [productNFT, account, loadNFTs, checkUserRole]);

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'Common': return 'bg-gray-100 text-gray-800';
      case 'Rare': return 'bg-blue-100 text-blue-800';
      case 'Epic': return 'bg-purple-100 text-purple-800';
      case 'Legendary': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const tabs = [
    { id: 'gallery', label: 'NFT Gallery', icon: '🖼️', count: nfts.length },
    { id: 'transfer', label: 'Transfer NFT', icon: '↗️' },
    { id: 'marketplace', label: 'Marketplace', icon: '🏪' }
  ];

  // Add minting tab if user is a minter
  if (userRole === 'minter') {
    tabs.splice(-1, 0, { id: 'mint', label: 'Mint NFT', icon: '⚡' });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">🖼️ Product NFTs</h2>
        <p className="text-gray-600">The Digital Certificate (NFT Collection)</p>
        <div className="mt-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            userRole === 'minter' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {userRole === 'minter' ? '⚡ NFT Minter' : '👤 Collector'}
          </span>
        </div>
      </div>

      {/* Collection Stats */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{nfts.length}</div>
            <div className="text-sm text-gray-600">Owned NFTs</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {nfts.filter(nft => nft.metadata.attributes.find(attr => attr.value === 'Verified')).length}
            </div>
            <div className="text-sm text-gray-600">Verified</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {nfts.filter(nft => nft.metadata.attributes.find(attr => attr.value === 'Rare' || attr.value === 'Epic' || attr.value === 'Legendary')).length}
            </div>
            <div className="text-sm text-gray-600">Rare & Above</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">
              {new Set(nfts.map(nft => nft.metadata.attributes.find(attr => attr.trait_type === 'Product Type')?.value)).size}
            </div>
            <div className="text-sm text-gray-600">Categories</div>
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

      {loading && <LoadingSpinner message="Loading NFTs..." />}

      {/* Gallery Tab */}
      {activeTab === 'gallery' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Your NFT Collection</h3>
            <Button variant="secondary" onClick={loadNFTs} disabled={loading}>
              Refresh Collection
            </Button>
          </div>
          
          {nfts.length === 0 ? (
            <Card>
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">🖼️</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No NFTs Yet</h3>
                <p className="text-gray-600">You don't own any Product NFTs yet. Get started by purchasing authenticated products or minting NFTs.</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nfts.map((nft) => (
                <Card key={nft.tokenId} className="overflow-hidden">
                  <div className="space-y-4">
                    {/* NFT Image */}
                    <div className="relative">
                      <img
                        src={nft.metadata.image}
                        alt={nft.metadata.name}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <div className="absolute top-2 right-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          getRarityColor(nft.metadata.attributes.find(attr => attr.trait_type === 'Rarity')?.value)
                        }`}>
                          {nft.metadata.attributes.find(attr => attr.trait_type === 'Rarity')?.value}
                        </span>
                      </div>
                    </div>
                    
                    {/* NFT Info */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">{nft.metadata.name}</h4>
                      <p className="text-sm text-gray-600 mb-3">{nft.metadata.description}</p>
                      
                      {/* Attributes */}
                      <div className="space-y-2">
                        {nft.metadata.attributes.map((attr, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="font-medium text-gray-700">{attr.trait_type}:</span>
                            <span className="text-gray-600">{attr.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedNFT(nft)}
                        className="flex-1"
                      >
                        View Details
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          const price = prompt('Enter listing price in ETH:');
                          if (price && parseFloat(price) > 0) {
                            listOnMarketplace(nft.tokenId, price);
                          }
                        }}
                        className="flex-1"
                        disabled={loading}
                      >
                        List for Sale
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transfer Tab */}
      {activeTab === 'transfer' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transfer NFT</h3>
          <form onSubmit={transferNFT} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token ID
              </label>
              <select
                value={transferForm.tokenId}
                onChange={(e) => setTransferForm({...transferForm, tokenId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select NFT to transfer</option>
                {nfts.filter(nft => nft.isOwned).map(nft => (
                  <option key={nft.tokenId} value={nft.tokenId}>
                    #{nft.tokenId} - {nft.metadata.name}
                  </option>
                ))}
              </select>
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
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Warning:</span> NFT transfers are permanent and cannot be undone. Make sure the recipient address is correct.
              </p>
            </div>
            <Button type="submit" disabled={loading || !transferForm.tokenId || !transferForm.toAddress}>
              {loading ? 'Transferring...' : 'Transfer NFT'}
            </Button>
          </form>
        </Card>
      )}

      {/* Mint Tab */}
      {activeTab === 'mint' && userRole === 'minter' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Mint New NFT</h3>
          <form onSubmit={mintNFT} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product ID
              </label>
              <input
                type="number"
                value={mintForm.productId}
                onChange={(e) => setMintForm({...mintForm, productId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter product ID"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NFT Name
              </label>
              <input
                type="text"
                value={mintForm.metadata.name}
                onChange={(e) => setMintForm({
                  ...mintForm, 
                  metadata: {...mintForm.metadata, name: e.target.value}
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Authentic iPhone 15 Certificate"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={mintForm.metadata.description}
                onChange={(e) => setMintForm({
                  ...mintForm, 
                  metadata: {...mintForm.metadata, description: e.target.value}
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="Describe the NFT and product authenticity..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image URL
              </label>
              <input
                type="url"
                value={mintForm.metadata.image}
                onChange={(e) => setMintForm({
                  ...mintForm, 
                  metadata: {...mintForm.metadata, image: e.target.value}
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/image.jpg"
                required
              />
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Note:</span> As a minter, you can create NFT certificates for authenticated products. Each NFT represents proof of authenticity and ownership.
              </p>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Minting...' : 'Mint NFT'}
            </Button>
          </form>
        </Card>
      )}

      {/* Marketplace Tab */}
      {activeTab === 'marketplace' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">NFT Marketplace Integration</h3>
          
          <Card>
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🏪</div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Marketplace Coming Soon</h4>
              <p className="text-gray-600 mb-4">
                The integrated NFT marketplace will allow you to buy, sell, and discover authenticated product NFTs.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="font-medium text-blue-900">Buy NFTs</div>
                  <div className="text-blue-700">Purchase authenticated product certificates</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="font-medium text-green-900">Sell NFTs</div>
                  <div className="text-green-700">List your NFTs for sale with pricing</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="font-medium text-purple-900">Discover</div>
                  <div className="text-purple-700">Explore rare and unique product NFTs</div>
                </div>
              </div>
            </div>
          </Card>

          {/* User's Listed NFTs */}
          <Card>
            <h4 className="font-medium text-gray-900 mb-4">Your Listed NFTs</h4>
            <div className="text-center py-6 text-gray-500">
              <p>No NFTs currently listed for sale</p>
              <p className="text-sm mt-1">Use the "List for Sale" button in your gallery to list NFTs</p>
            </div>
          </Card>
        </div>
      )}

      {/* NFT Detail Modal */}
      {selectedNFT && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
            <Card>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-900">NFT Details</h3>
                <Button variant="secondary" size="sm" onClick={() => setSelectedNFT(null)}>
                  ✕
                </Button>
              </div>
              
              <div className="space-y-6">
                {/* NFT Image */}
                <img
                  src={selectedNFT.metadata.image}
                  alt={selectedNFT.metadata.name}
                  className="w-full h-64 object-cover rounded-lg"
                />
                
                {/* NFT Info */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{selectedNFT.metadata.name}</h4>
                  <p className="text-gray-600 mb-4">{selectedNFT.metadata.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Token ID:</span>
                      <span className="ml-2 text-gray-600">#{selectedNFT.tokenId}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Owner:</span>
                      <span className="ml-2 text-gray-600">
                        {selectedNFT.owner.slice(0, 6)}...{selectedNFT.owner.slice(-4)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Attributes */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Attributes</h5>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedNFT.metadata.attributes.map((attr, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-700">{attr.trait_type}</div>
                        <div className="text-lg font-semibold text-gray-900">{attr.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Transfer History */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Transfer History</h5>
                  <div className="space-y-2">
                    {selectedNFT.transferHistory.map((transfer, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{transfer.type}</div>
                          <div className="text-xs text-gray-600">
                            {transfer.from === '0x0000000000000000000000000000000000000000' ? 'Minted' : 
                             `${transfer.from.slice(0, 6)}...${transfer.from.slice(-4)}`} → 
                            {transfer.to.slice(0, 6)}...{transfer.to.slice(-4)}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          {transfer.timestamp.toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductNFTPanel;
