import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import ProductNFTABI from '../contracts/ProductNFT.json';
import marketplaceConfig from '../marketplaceConfig.json';

/**
 * Hook to fetch and manage user's owned NFTs
 */
export const useMyNFTs = () => {
  const { account, provider, isConnected } = useWallet();
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // NFT metadata mapping (from our marketplace listings)
  const nftMetadata = {
    '1': { name: 'Premium Coffee Beans NFT', category: 'Food & Beverage', rarity: 'Rare', originalPrice: '0.5' },
    '2': { name: 'Organic Cotton T-Shirt NFT', category: 'Clothing', rarity: 'Common', originalPrice: '0.3' },
    '3': { name: 'Artisan Leather Wallet NFT', category: 'Accessories', rarity: 'Epic', originalPrice: '0.8' },
    '4': { name: 'Handmade Ceramic Mug NFT', category: 'Art & Crafts', rarity: 'Common', originalPrice: '0.2' }
  };

  const fetchMyNFTs = useCallback(async () => {
    if (!account || !provider || !isConnected) {
      console.log('[useMyNFTs] Not ready:', { account, hasProvider: !!provider, isConnected });
      setNfts([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[useMyNFTs] Fetching NFTs for account:', account);
      console.log('[useMyNFTs] ProductNFT contract:', marketplaceConfig.productNFT);

      // Create contract instance
      const productNFT = new ethers.Contract(
        marketplaceConfig.productNFT,
        ProductNFTABI.abi,
        provider
      );

      const ownedNFTs = [];

      // Check ownership of known token IDs (1-10 to be safe)
      for (let tokenId = 1; tokenId <= 10; tokenId++) {
        try {
          const owner = await productNFT.ownerOf(tokenId);
          console.log(`[useMyNFTs] Token #${tokenId} owner:`, owner);
          
          if (owner.toLowerCase() === account.toLowerCase()) {
            console.log(`[useMyNFTs] ✅ You own token #${tokenId}!`);
            // Get token URI
            let tokenURI = '';
            try {
              tokenURI = await productNFT.tokenURI(tokenId);
            } catch (e) {
              console.log(`No URI for token ${tokenId}`);
            }

            // Get product ID
            let productId = '';
            try {
              productId = await productNFT.getProductId(tokenId);
            } catch (e) {
              console.log(`No product ID for token ${tokenId}`);
            }

            // Get metadata if available
            const metadata = nftMetadata[tokenId.toString()] || {
              name: `Product NFT #${tokenId}`,
              category: 'Unknown',
              rarity: 'Common',
              originalPrice: '0'
            };

            ownedNFTs.push({
              tokenId: tokenId.toString(),
              owner: owner,
              tokenURI: tokenURI,
              productId: productId,
              ...metadata
            });
          }
        } catch (err) {
          // Token doesn't exist or error checking ownership
          if (!err.message.includes('ERC721NonexistentToken')) {
            console.error(`Error checking token ${tokenId}:`, err);
          }
        }
      }

      console.log('[useMyNFTs] Total NFTs found:', ownedNFTs.length);
      setNfts(ownedNFTs);
    } catch (err) {
      console.error('[useMyNFTs] Error fetching NFTs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [account, provider, isConnected]);

  useEffect(() => {
    fetchMyNFTs();
  }, [fetchMyNFTs]);

  return {
    nfts,
    loading,
    error,
    refresh: fetchMyNFTs,
    totalNFTs: nfts.length
  };
};

export default useMyNFTs;

