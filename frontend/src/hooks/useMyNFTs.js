import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "../contexts/WalletContext";
import ProductNFTABI from "../contracts/ProductNFT.json";
import ProductRegistryABI from "../contracts/ProductRegistry.json";

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
    1: {
      name: "Premium Coffee Beans NFT",
      category: "Food & Beverage",
      rarity: "Rare",
      originalPrice: "0.5",
    },
    2: {
      name: "Organic Cotton T-Shirt NFT",
      category: "Clothing",
      rarity: "Common",
      originalPrice: "0.3",
    },
    3: {
      name: "Artisan Leather Wallet NFT",
      category: "Accessories",
      rarity: "Epic",
      originalPrice: "0.8",
    },
    4: {
      name: "Handmade Ceramic Mug NFT",
      category: "Art & Crafts",
      rarity: "Common",
      originalPrice: "0.2",
    },
  };

  const fetchMyNFTs = useCallback(async () => {
    if (!account || !provider || !isConnected) {
      console.log("[useMyNFTs] Not ready:", {
        account,
        hasProvider: !!provider,
        isConnected,
      });
      setNfts([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const productNFTAddress = process.env.REACT_APP_PRODUCT_NFT_ADDRESS;
      const productRegistryAddress =
        process.env.REACT_APP_PRODUCT_REGISTRY_ADDRESS;

      if (!productNFTAddress || !productRegistryAddress) {
        console.warn("[useMyNFTs] Contract addresses not configured");
        setNfts([]);
        setLoading(false);
        return;
      }

      console.log("[useMyNFTs] Fetching NFTs for account:", account);
      console.log("[useMyNFTs] ProductNFT contract:", productNFTAddress);

      // Create contract instances
      const productNFT = new ethers.Contract(
        productNFTAddress,
        ProductNFTABI.abi,
        provider
      );

      const productRegistry = new ethers.Contract(
        productRegistryAddress,
        ProductRegistryABI.abi,
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
            let tokenURI = "";
            try {
              tokenURI = await productNFT.tokenURI(tokenId);
            } catch (e) {
              console.log(`No URI for token ${tokenId}`);
            }

            // Get product ID
            let productId = "";
            let productName = `Product NFT #${tokenId}`;
            let category = "Unknown";

            try {
              productId = await productNFT.nftToProductId(tokenId);
              console.log(`Product ID for token ${tokenId}:`, productId);

              // Get product details from registry
              if (
                productId &&
                productId !==
                  "0x0000000000000000000000000000000000000000000000000000000000000000"
              ) {
                try {
                  const product = await productRegistry.getProduct(productId);
                  console.log(`Product details for NFT ${tokenId}:`, product);

                  if (product.metadataURI) {
                    // Parse metadata URI: format is "name-timestamp#category=X&value=Y"
                    // Handle case-insensitive ipfs:// prefix
                    let uri = product.metadataURI.replace(/^ipfs:\/\//i, "");

                    // Extract category from hash parameters first
                    const hashParts = uri.split("#");
                    if (hashParts.length > 1) {
                      const params = new URLSearchParams(hashParts[1]);
                      const categoryParam = params.get("category");
                      if (categoryParam) {
                        // Capitalize category
                        category =
                          categoryParam.charAt(0).toUpperCase() +
                          categoryParam.slice(1);
                      }
                    }

                    // Extract just the product name (before the timestamp and hash)
                    let namePart = hashParts[0]; // Get part before #

                    // Remove IPFS hash prefix if exists (starts with Qm)
                    namePart = namePart.replace(/^Qm[A-Za-z0-9]+/, "");

                    // Remove timestamp suffix (ends with -followed by numbers)
                    namePart = namePart.replace(/-\d+$/, "");

                    // Clean up any remaining leading/trailing separators
                    namePart = namePart.replace(/^[-_]+|[-_]+$/g, "");

                    // Convert to readable name
                    if (namePart) {
                      productName = namePart
                        .replace(/[-_]/g, " ")
                        .split(" ")
                        .filter((w) => w.length > 0)
                        .map(
                          (w) =>
                            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
                        )
                        .join(" ");

                      // Add NFT suffix if not present
                      if (!productName.includes("NFT")) {
                        productName += " NFT";
                      }
                    }
                  }
                } catch (e) {
                  console.log(`Could not fetch product details:`, e);
                }
              }
            } catch (e) {
              console.log(`No product ID for token ${tokenId}`);
            }

            // Use real blockchain data, fallback to hardcoded only if needed
            const fallbackMetadata = nftMetadata[tokenId.toString()];

            ownedNFTs.push({
              tokenId: tokenId.toString(),
              owner: owner,
              tokenURI: tokenURI,
              productId: productId || "N/A",
              name: productName, // Real name from product metadataURI
              category: category, // Real category or derived from URI
              rarity: fallbackMetadata?.rarity || "Rare",
              originalPrice: fallbackMetadata?.originalPrice || "0",
            });
          }
        } catch (err) {
          // Token doesn't exist or error checking ownership
          if (!err.message.includes("ERC721NonexistentToken")) {
            console.error(`Error checking token ${tokenId}:`, err);
          }
        }
      }

      console.log("[useMyNFTs] Total NFTs found:", ownedNFTs.length);
      setNfts(ownedNFTs);
    } catch (err) {
      console.error("[useMyNFTs] Error fetching NFTs:", err);
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
    totalNFTs: nfts.length,
  };
};

export default useMyNFTs;
