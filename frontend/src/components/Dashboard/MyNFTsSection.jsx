import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AiOutlineShoppingCart, AiOutlineEye } from "react-icons/ai";
import { MdVerified } from "react-icons/md";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import Card from "../Common/Card";
import LoadingSpinner from "../Common/LoadingSpinner";
import Modal from "../Common/Modal";
import Button from "../Common/Button";
import useMyNFTs from "../../hooks/useMyNFTs";
import { useWallet } from "../../contexts/WalletContext";
import ProductNFTABI from "../../contracts/ProductNFT.json";
import MarketplaceABI from "../../contracts/Marketplace.json";
import { ButtonVariants, ModalSizes } from "../../types";

const MyNFTsSection = () => {
  const { nfts, loading, error, totalNFTs, refresh } = useMyNFTs();
  const { signer, account } = useWallet();
  const [showListModal, setShowListModal] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [listPrice, setListPrice] = useState("");

  const getRarityColor = (rarity) => {
    switch (rarity?.toLowerCase()) {
      case "common":
        return "text-gray-600 bg-gray-100";
      case "rare":
        return "text-blue-600 bg-blue-100";
      case "epic":
        return "text-purple-600 bg-purple-100";
      case "legendary":
        return "text-orange-600 bg-orange-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const handleListNFT = async () => {
    if (!signer || !account || !selectedNFT) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!listPrice || parseFloat(listPrice) <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    try {
      const productNFTAddress = process.env.REACT_APP_PRODUCT_NFT_ADDRESS;
      const marketplaceAddress = process.env.REACT_APP_MARKETPLACE_ADDRESS;

      const productNFT = new ethers.Contract(
        productNFTAddress,
        ProductNFTABI.abi,
        signer
      );
      const marketplace = new ethers.Contract(
        marketplaceAddress,
        MarketplaceABI.abi,
        signer
      );

      // Step 1: Approve marketplace to transfer NFT
      toast.info("Approving marketplace...");
      const approveTx = await productNFT.approve(
        marketplaceAddress,
        selectedNFT.tokenId
      );
      await approveTx.wait();

      // Step 2: Create listing
      toast.info("Creating listing...");
      const priceInWei = ethers.parseEther(listPrice);
      const listTx = await marketplace.createListing(
        selectedNFT.tokenId,
        priceInWei
      );
      await listTx.wait();

      toast.success(
        `✅ NFT #${selectedNFT.tokenId} listed for ${listPrice} ETH!`
      );
      setShowListModal(false);
      setListPrice("");
      setSelectedNFT(null);
      if (refresh) refresh();
    } catch (error) {
      console.error("Error listing NFT:", error);
      if (error.message.includes("user rejected")) {
        toast.warning("Transaction cancelled");
      } else {
        toast.error(error.message || "Failed to list NFT");
      }
    }
  };

  const openListModal = (nft) => {
    setSelectedNFT(nft);
    setShowListModal(true);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner message="Loading your NFTs..." />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-red-500">Error loading NFTs: {error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AiOutlineShoppingCart className="text-primary-blue" />
            My NFT Collection
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {totalNFTs === 0
              ? "No NFTs owned yet"
              : `You own ${totalNFTs} NFT${totalNFTs !== 1 ? "s" : ""}`}
          </p>
        </div>

        {totalNFTs > 0 && (
          <Link
            to="/marketplace"
            className="text-primary-blue hover:text-primary-blue-hover font-medium text-sm flex items-center gap-1 whitespace-nowrap"
          >
            <AiOutlineEye size={18} />
            Browse More
          </Link>
        )}
      </div>

      {/* NFT Grid */}
      {totalNFTs === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4">
            <AiOutlineShoppingCart size={40} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No NFTs Yet
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Start building your collection by purchasing authenticated product
            NFTs from the marketplace
          </p>
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-blue text-white rounded-lg hover:bg-primary-blue-hover transition-colors font-medium"
          >
            <AiOutlineShoppingCart size={20} />
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {nfts.map((nft) => (
            <div
              key={nft.tokenId}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200"
            >
              {/* NFT Image Placeholder */}
              <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <div className="absolute top-3 right-3 bg-green-500 text-white p-1.5 rounded-full">
                  <MdVerified size={16} />
                </div>
                <div className="text-gray-400">
                  <svg
                    className="w-20 h-20"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs font-medium">
                  #{nft.tokenId}
                </div>
              </div>

              {/* NFT Details */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm truncate">
                    {nft.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{nft.category}</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Rarity:</span>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${getRarityColor(
                      nft.rarity
                    )}`}
                  >
                    {nft.rarity}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Purchased:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {nft.originalPrice} ETH
                  </span>
                </div>

                {nft.productId && (
                  <div className="pt-2">
                    <p
                      className="text-xs text-gray-400 truncate"
                      title={nft.productId}
                    >
                      Product: {nft.productId.slice(0, 10)}...
                    </p>
                  </div>
                )}

                {/* List for Sale Button */}
                <button
                  onClick={() => openListModal(nft)}
                  className="w-full mt-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                >
                  🏷️ List for Sale
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List NFT Modal */}
      <Modal
        open={showListModal}
        title={`List NFT #${selectedNFT?.tokenId} for Sale`}
        onClose={() => {
          setShowListModal(false);
          setListPrice("");
          setSelectedNFT(null);
        }}
        maxWidth={ModalSizes.SMALL}
      >
        <div className="space-y-4">
          {selectedNFT && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900">
                {selectedNFT.name}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedNFT.category}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Token #{selectedNFT.tokenId}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Listing Price (ETH) *
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              placeholder="e.g. 0.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Platform fee: 2.5% | Royalty: 2.5%
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant={ButtonVariants.SECONDARY}
              onClick={() => {
                setShowListModal(false);
                setListPrice("");
                setSelectedNFT(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariants.PRIMARY}
              onClick={handleListNFT}
              disabled={!listPrice || parseFloat(listPrice) <= 0}
              className="flex-1"
            >
              List NFT
            </Button>
          </div>
        </div>
      </Modal>

      {/* Footer */}
      {totalNFTs > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            All NFTs are verified and authenticated on the blockchain
          </p>
        </div>
      )}
    </Card>
  );
};

export default MyNFTsSection;
