import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { useWallet } from '../contexts/WalletContext';
import { CONTRACT_ADDRESSES } from '../utils/constants';
import FeeDistributorABI from '../contracts/FeeDistributor.json';
import AuthTokenABI from '../contracts/AuthToken.json';

// Import contract ABIs for product-related contracts (these need to be generated)
// import ProductRegistryABI from '../contracts/ProductRegistry.json';
// import ProductNFTABI from '../contracts/ProductNFT.json';

// For now, using dummy ABIs - replace with actual contract ABIs when available
const ProductRegistryABI = [];
const ProductNFTABI = [];

export const useContracts = () => {
  const { signer, provider } = useWallet();
  const [contracts, setContracts] = useState({
    feeDistributor: null,
    authToken: null,
    productRegistry: null,
    productNFT: null,
  });

  useEffect(() => {
    // Check if we have valid contract addresses (not placeholder values)
    const hasValidFeeDistributor = CONTRACT_ADDRESSES.FEE_DISTRIBUTOR && 
      CONTRACT_ADDRESSES.FEE_DISTRIBUTOR !== '0x...' &&
      CONTRACT_ADDRESSES.FEE_DISTRIBUTOR.length === 42;
      
    const hasValidAuthToken = CONTRACT_ADDRESSES.AUTH_TOKEN && 
      CONTRACT_ADDRESSES.AUTH_TOKEN !== '0x...' &&
      CONTRACT_ADDRESSES.AUTH_TOKEN.length === 42;

    if (provider && hasValidFeeDistributor && hasValidAuthToken) {
      try {
        const feeDistributor = new ethers.Contract(
          CONTRACT_ADDRESSES.FEE_DISTRIBUTOR,
          FeeDistributorABI,
          signer || provider
        );

        const authToken = new ethers.Contract(
          CONTRACT_ADDRESSES.AUTH_TOKEN,
          AuthTokenABI,
          signer || provider
        );

        // Initialize product-related contracts when ABIs are available
        let productRegistry = null;
        let productNFT = null;
        
        if (CONTRACT_ADDRESSES.PRODUCT_REGISTRY && 
            CONTRACT_ADDRESSES.PRODUCT_REGISTRY !== '0x...' &&
            ProductRegistryABI.length > 0) {
          productRegistry = new ethers.Contract(
            CONTRACT_ADDRESSES.PRODUCT_REGISTRY,
            ProductRegistryABI,
            signer || provider
          );
        }

        if (CONTRACT_ADDRESSES.PRODUCT_NFT && ProductNFTABI.length > 0) {
          productNFT = new ethers.Contract(
            CONTRACT_ADDRESSES.PRODUCT_NFT,
            ProductNFTABI,
            signer || provider
          );
        }

        setContracts({
          feeDistributor,
          authToken,
          productRegistry,
          productNFT,
        });
      } catch (error) {
        console.error('Error initializing contracts:', error);
      }
    }
  }, [signer, provider]);

  return contracts;
};

export const useProductRegistry = () => {
  const { provider, signer, isConnected } = useWallet();
  const [contract, setContract] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (provider && CONTRACT_ADDRESSES.PRODUCT_REGISTRY && ProductRegistryABI.length > 0) {
      const productRegistryContract = new ethers.Contract(
        CONTRACT_ADDRESSES.PRODUCT_REGISTRY,
        ProductRegistryABI,
        provider
      );
      setContract(productRegistryContract);
    }
  }, [provider]);

  const registerProduct = useCallback(async (productData) => {
    if (!contract || !signer || !isConnected) {
      toast.error('Please connect your wallet first');
      return null;
    }

    setIsLoading(true);
    try {
      const contractWithSigner = contract.connect(signer);
      const { productId, metadataURI } = productData;
      
      const tx = await contractWithSigner.registerProduct(
        productId,
        metadataURI
      );
      
      toast.info('Transaction submitted. Waiting for confirmation...');
      const receipt = await tx.wait();
      
      toast.success('Product registered successfully!');
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        productId
      };
    } catch (error) {
      console.error('Error registering product:', error);
      toast.error(`Failed to register product: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [contract, signer, isConnected]);

  const getProduct = useCallback(async (productId) => {
    if (!contract) return null;

    try {
      const product = await contract.products(productId);
      return {
        productId: product.productId,
        manufacturer: product.manufacturer,
        currentOwner: product.currentOwner,
        status: product.status,
        registeredAt: product.registeredAt,
        metadataURI: product.metadataURI,
        exists: product.exists
      };
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  }, [contract]);

  const transferProduct = useCallback(async (productId, to, location = '') => {
    if (!contract || !signer || !isConnected) {
      toast.error('Please connect your wallet first');
      return null;
    }

    setIsLoading(true);
    try {
      const contractWithSigner = contract.connect(signer);
      const tx = await contractWithSigner.transferProduct(productId, to, location);
      
      toast.info('Transaction submitted. Waiting for confirmation...');
      const receipt = await tx.wait();
      
      toast.success('Product transferred successfully!');
      return {
        success: true,
        transactionHash: receipt.transactionHash
      };
    } catch (error) {
      console.error('Error transferring product:', error);
      toast.error(`Failed to transfer product: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [contract, signer, isConnected]);

  return {
    contract,
    isLoading,
    registerProduct,
    getProduct,
    transferProduct
  };
};

export const useProductNFT = () => {
  const { provider, signer, isConnected } = useWallet();
  const [contract, setContract] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (provider && CONTRACT_ADDRESSES.PRODUCT_NFT && ProductNFTABI.length > 0) {
      const productNFTContract = new ethers.Contract(
        CONTRACT_ADDRESSES.PRODUCT_NFT,
        ProductNFTABI,
        provider
      );
      setContract(productNFTContract);
    }
  }, [provider]);

  const mintNFT = useCallback(async (to, productId, metadataURI) => {
    if (!contract || !signer || !isConnected) {
      toast.error('Please connect your wallet first');
      return null;
    }

    setIsLoading(true);
    try {
      const contractWithSigner = contract.connect(signer);
      const tx = await contractWithSigner.safeMint(to, productId, metadataURI);
      
      toast.info('Transaction submitted. Waiting for confirmation...');
      const receipt = await tx.wait();
      
      // Get the token ID from the event logs
      const mintEvent = receipt.events?.find(e => e.event === 'ProductNFTMinted');
      const tokenId = mintEvent?.args?.tokenId;
      
      toast.success('NFT minted successfully!');
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        tokenId: tokenId?.toString()
      };
    } catch (error) {
      console.error('Error minting NFT:', error);
      toast.error(`Failed to mint NFT: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [contract, signer, isConnected]);

  const getNFTDetails = useCallback(async (tokenId) => {
    if (!contract) return null;

    try {
      const [owner, productId, uri] = await Promise.all([
        contract.ownerOf(tokenId),
        contract.nftToProductId(tokenId),
        contract.tokenURI(tokenId)
      ]);

      return {
        tokenId,
        owner,
        productId,
        tokenURI: uri
      };
    } catch (error) {
      console.error('Error fetching NFT details:', error);
      return null;
    }
  }, [contract]);

  const getUserNFTs = useCallback(async (userAddress) => {
    if (!contract) return [];

    try {
      const balance = await contract.balanceOf(userAddress);
      const nfts = [];

      for (let i = 0; i < balance; i++) {
        const tokenId = await contract.tokenOfOwnerByIndex(userAddress, i);
        const nftDetails = await getNFTDetails(tokenId);
        if (nftDetails) {
          nfts.push(nftDetails);
        }
      }

      return nfts;
    } catch (error) {
      console.error('Error fetching user NFTs:', error);
      return [];
    }
  }, [contract, getNFTDetails]);

  return {
    contract,
    isLoading,
    mintNFT,
    getNFTDetails,
    getUserNFTs
  };
};
