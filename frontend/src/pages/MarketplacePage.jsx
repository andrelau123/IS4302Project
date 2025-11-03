import React, { useState, useEffect } from "react";
import { AiOutlineShoppingCart, AiOutlineVerified } from "react-icons/ai";
import { MdVerified } from "react-icons/md";
import Card from "../components/Common/Card";
import Button from "../components/Common/Button";
import LoadingSpinner from "../components/Common/LoadingSpinner";
import { useWallet } from "../contexts/WalletContext";
import { ButtonVariants } from "../types";
import { ethers } from "ethers";
import MarketplaceABI from "../contracts/Marketplace.json";
import ProductNFTABI from "../contracts/ProductNFT.json";
import ProductRegistryABI from "../contracts/ProductRegistry.json";
import { toast } from "react-toastify";

const MarketplacePage = () => {
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priceSort, setPriceSort] = useState("none");

  const { account, isConnected, signer, provider } = useWallet();

  // Mock marketplace data
  const mockListings = [
    {
      id: "1",
      tokenId: "101",
      name: "Premium Coffee Beans NFT",
      description:
        "Authentic Ethiopian single-origin coffee beans with blockchain verification",
      price: "0.5",
      currency: "ETH",
      image: "/api/placeholder/300/300",
      seller: "0xabc123...",
      isVerified: true,
      category: "Food & Beverage",
      rarity: "Rare",
      likes: 45,
      views: 234,
    },
    {
      id: "2",
      tokenId: "102",
      name: "Organic Cotton T-Shirt NFT",
      description:
        "Sustainably sourced organic cotton apparel with authenticity guarantee",
      price: "0.3",
      currency: "ETH",
      image: "/api/placeholder/300/300",
      seller: "0xdef456...",
      isVerified: true,
      category: "Clothing",
      rarity: "Common",
      likes: 23,
      views: 156,
    },
    {
      id: "3",
      tokenId: "103",
      name: "Artisan Leather Wallet NFT",
      description:
        "Handcrafted genuine leather wallet with provenance tracking",
      price: "0.8",
      currency: "ETH",
      image: "/api/placeholder/300/300",
      seller: "0xghi789...",
      isVerified: true,
      category: "Accessories",
      rarity: "Epic",
      likes: 67,
      views: 445,
    },
    {
      id: "4",
      tokenId: "104",
      name: "Handmade Ceramic Mug NFT",
      description: "Unique ceramic mug with artist authenticity certificate",
      price: "0.2",
      currency: "ETH",
      image: "/api/placeholder/300/300",
      seller: "0xjkl012...",
      isVerified: false,
      category: "Art & Crafts",
      rarity: "Common",
      likes: 12,
      views: 89,
    },
  ];

  useEffect(() => {
    if (provider) {
      loadListings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  useEffect(() => {
    filterAndSortListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, searchTerm, categoryFilter, priceSort]);

  const parseNFTName = (metadataURI, category) => {
    if (!metadataURI) return "Product NFT";

    try {
      // Remove ipfs:// prefix (case-insensitive)
      let cleanURI = metadataURI.replace(/^ipfs:\/\//i, "");

      // Split at '#' to separate name from parameters
      const [namePart] = cleanURI.split("#");
      if (!namePart) return "Product NFT";

      let cleanName = namePart;

      // Remove IPFS hash if present (starts with Qm)
      cleanName = cleanName.replace(/^Qm[A-Za-z0-9]+[-_]?/i, "");

      // Remove timestamp suffix (e.g., -1762191933015)
      cleanName = cleanName.replace(/-\d+$/, "");

      // Replace separators with spaces
      cleanName = cleanName.replace(/[-_]/g, " ");

      // Remove leading/trailing spaces
      cleanName = cleanName.trim();

      // Capitalize each word
      cleanName = cleanName
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      // Add NFT suffix
      return cleanName ? `${cleanName} NFT` : "Product NFT";
    } catch (error) {
      console.error("Error parsing NFT name:", error);
      return "Product NFT";
    }
  };

  const loadListings = async () => {
    setIsLoading(true);
    try {
      if (!provider) {
        console.log("Provider not ready");
        return;
      }

      const marketplaceAddress = process.env.REACT_APP_MARKETPLACE_ADDRESS;
      const productNFTAddress = process.env.REACT_APP_PRODUCT_NFT_ADDRESS;
      const productRegistryAddress =
        process.env.REACT_APP_PRODUCT_REGISTRY_ADDRESS;

      if (
        !marketplaceAddress ||
        !productNFTAddress ||
        !productRegistryAddress
      ) {
        console.log("Contract addresses not configured");
        setListings(mockListings); // Fallback to mock data
        return;
      }

      // Create contract instances
      const marketplace = new ethers.Contract(
        marketplaceAddress,
        MarketplaceABI.abi,
        provider
      );

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

      // Check NFT tokens 1-20 for active listings
      const availableListings = [];

      for (let tokenId = 1; tokenId <= 20; tokenId++) {
        try {
          const listing = await marketplace.listings(tokenId);

          if (listing.active) {
            const priceInEth = ethers.formatEther(listing.price);

            // Get product details
            let name = `Product NFT #${tokenId}`;
            let description =
              "Authentic verified product with blockchain certification";
            let category = "General";

            try {
              // Get productId from NFT
              const productId = await productNFT.nftToProductId(tokenId);

              // Get product details from registry
              const product = await productRegistry.products(productId);

              // Parse metadata URI for name
              if (product.metadataURI) {
                // Extract category from URI if present
                const categoryMatch =
                  product.metadataURI.match(/category=([^&]+)/);
                category = categoryMatch
                  ? categoryMatch[1].charAt(0).toUpperCase() +
                    categoryMatch[1].slice(1)
                  : "General";

                // Parse clean name
                name = parseNFTName(product.metadataURI, category);
                description = `Authentic ${category.toLowerCase()} product verified on blockchain`;
              }
            } catch (err) {
              console.log(
                `Could not fetch details for token ${tokenId}:`,
                err.message
              );
            }

            availableListings.push({
              id: tokenId.toString(),
              tokenId: tokenId.toString(),
              name: name,
              description: description,
              price: priceInEth,
              currency: "ETH",
              image: "/api/placeholder/300/300",
              seller: listing.seller,
              isVerified: true,
              category: category,
              rarity:
                parseFloat(priceInEth) > 0.5
                  ? "Epic"
                  : parseFloat(priceInEth) > 0.3
                  ? "Rare"
                  : "Common",
            });
          }
        } catch (error) {
          // Token doesn't exist or no listing
          continue;
        }
      }

      setListings(availableListings);

      if (availableListings.length === 0) {
        toast.info("No NFTs currently listed. Mint and list your own!");
      }
    } catch (error) {
      console.error("Error loading listings:", error);
      toast.error("Failed to load marketplace listings");
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortListings = () => {
    let filtered = [...listings];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (listing) =>
          listing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          listing.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          listing.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(
        (listing) => listing.category === categoryFilter
      );
    }

    // Price sorting
    if (priceSort !== "none") {
      filtered.sort((a, b) => {
        const priceA = parseFloat(a.price);
        const priceB = parseFloat(b.price);
        return priceSort === "low" ? priceA - priceB : priceB - priceA;
      });
    }

    setFilteredListings(filtered);
  };

  const handlePurchase = async (listing) => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!signer || !account) {
      toast.error("Wallet not properly connected");
      return;
    }

    // Request account access if not already granted
    try {
      if (window.ethereum) {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      }
    } catch (err) {
      toast.error("Please approve the connection in MetaMask");
      return;
    }

    // Check if trying to buy own NFT
    if (listing.seller.toLowerCase() === account.toLowerCase()) {
      toast.error("You cannot buy your own NFT!");
      return;
    }

    try {
      setIsLoading(true);
      toast.info(`Purchasing ${listing.name}...`);

      const marketplaceAddress = process.env.REACT_APP_MARKETPLACE_ADDRESS;
      if (!marketplaceAddress) {
        toast.error("Marketplace not configured");
        return;
      }

      // Create marketplace contract instance
      const marketplace = new ethers.Contract(
        marketplaceAddress,
        MarketplaceABI.abi,
        signer
      );

      // Purchase NFT - send ETH as value
      const priceInWei = ethers.parseEther(listing.price);
      const tx = await marketplace.purchaseNFT(listing.tokenId, {
        value: priceInWei,
      });

      toast.info("Transaction submitted! Waiting for confirmation...");
      await tx.wait();

      toast.success(
        `🎉 Successfully purchased ${listing.name} for ${listing.price} ETH!`
      );

      // Refresh listings
      await loadListings();
    } catch (error) {
      console.error("Purchase failed:", error);

      if (
        error.code === "ACTION_REJECTED" ||
        error.message?.includes("user rejected")
      ) {
        toast.warning("Transaction was rejected");
      } else if (error.message?.includes("insufficient funds")) {
        toast.error("Insufficient ETH to complete purchase");
      } else if (error.message?.includes("Not listed")) {
        toast.error("This NFT is no longer listed for sale");
        await loadListings();
      } else {
        toast.error("Purchase failed: " + (error.reason || error.message));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  const getRarityColor = (rarity) => {
    switch (rarity.toLowerCase()) {
      case "common":
        return "text-gray-600";
      case "rare":
        return "text-blue-600";
      case "epic":
        return "text-purple-600";
      case "legendary":
        return "text-orange-600";
      default:
        return "text-gray-600";
    }
  };

  const categories = [
    "All",
    "Food & Beverage",
    "Clothing",
    "Electronics",
    "Accessories",
    "Art & Crafts",
  ];

  return (
    <div className="pt-20 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          NFT Marketplace
        </h1>
        <p className="text-gray-600">
          Discover and collect authenticated product NFTs
        </p>
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
          {categories.slice(1).map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
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
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="text-center">
          <div className="text-2xl font-bold text-primary-blue">
            {listings.length}
          </div>
          <div className="text-sm text-gray-600">Total Listed NFTs</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-primary-green">
            {listings.filter((l) => l.isVerified).length}
          </div>
          <div className="text-sm text-gray-600">Verified NFTs</div>
        </Card>
      </div>

      {/* Listings Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner message="Loading marketplace..." />
        </div>
      ) : filteredListings.length === 0 ? (
        <Card className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No NFTs found
          </h3>
          <p className="text-gray-600">
            {listings.length === 0
              ? "No NFTs are currently listed in the marketplace."
              : "No NFTs match your current filters."}
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
                  <span
                    className={`font-medium ${getRarityColor(listing.rarity)}`}
                  >
                    {listing.rarity}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Seller:</span>
                  <span className="font-medium">
                    {formatAddress(listing.seller)}
                  </span>
                </div>

                {/* Price and Actions */}
                <div className="pt-3 border-t border-gray-200">
                  <div className="mb-3">
                    <div className="text-lg font-bold text-gray-900">
                      {listing.price} {listing.currency}
                    </div>
                    <div className="text-xs text-gray-500">
                      ≈ ${(parseFloat(listing.price) * 2000).toFixed(0)} USD
                    </div>
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
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketplacePage;
