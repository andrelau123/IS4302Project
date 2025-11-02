import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  AiOutlineShop,
  AiOutlineSafetyCertificate,
  AiOutlineUser,
  AiOutlineBarChart,
  AiOutlineWallet,
  AiOutlineTrophy,
} from "react-icons/ai";
import { FaBoxes } from "react-icons/fa";
import { MdVerified } from "react-icons/md";

import { useWallet } from "../../contexts/WalletContext";
import { useFeeDistributor } from "../../hooks/useFeeDistributor";
import Card from "../Common/Card";
import Button from "../Common/Button";
import LoadingSpinner from "../Common/LoadingSpinner";
import WalletStatus from "../WalletStatus";
import NetworkSetupGuide from "../NetworkSetupGuide";
import DeploymentStatus from "../DeploymentStatus";
import DistributionChart from "./DistributionChart";
import MyNFTsSection from "./MyNFTsSection";
import { ButtonVariants } from "../../types";

const Dashboard = () => {
  const { isConnected, account, balance } = useWallet();
  const {
    loading,
    error,
    pendingRewards,
    totalEarnings,
    distributionShares,
    authTokenBalance,
    claimRewards,
    refreshData,
    checkAdminRole,
    checkDistributorRole,
  } = useFeeDistributor();

  const [claimingRewards, setClaimingRewards] = useState(false);

  const handleClaimRewards = async () => {
    try {
      setClaimingRewards(true);
      await claimRewards();
      alert("Rewards claimed successfully!");
    } catch (err) {
      alert(`Error claiming rewards: ${err.message}`);
    } finally {
      setClaimingRewards(false);
    }
  };

  const quickActions = [
    {
      title: "Register Product",
      description: "Add a new product to the registry",
      icon: <FaBoxes size={24} />,
      link: "/products",
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      title: "Browse Marketplace",
      description: "Explore authenticated product NFTs",
      icon: <AiOutlineShop size={24} />,
      link: "/marketplace",
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      title: "Verify Products",
      description: "Authenticate product authenticity",
      icon: <AiOutlineSafetyCertificate size={24} />,
      link: "/verification",
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      title: "Manage Retailers",
      description: "View and manage retailer registry",
      icon: <AiOutlineUser size={24} />,
      link: "/retailers",
      color: "bg-orange-500 hover:bg-orange-600",
    },
  ];

  const stats = [
    {
      title: "Wallet Balance",
      value: balance ? `${parseFloat(balance).toFixed(4)} ETH` : "0.0000 ETH",
      icon: <AiOutlineWallet size={24} />,
      color: "text-blue-600",
    },
    {
      title: "Total Earnings",
      value: totalEarnings ? `${totalEarnings} ETH` : "0.0000 ETH",
      icon: <AiOutlineTrophy size={24} />,
      color: "text-green-600",
    },
    {
      title: "Pending Rewards",
      value: pendingRewards ? `${pendingRewards} AUTH` : "0.00 AUTH",
      icon: <AiOutlineBarChart size={24} />,
      color: "text-purple-600",
    },
    {
      title: "Auth Token Balance",
      value: authTokenBalance ? `${authTokenBalance} AUTH` : "0.00 AUTH",
      icon: <MdVerified size={24} />,
      color: "text-orange-600",
    },
  ];

  if (!isConnected) {
    return (
      <div className="pt-20 p-6 max-w-7xl mx-auto">
        <div className="text-center py-20">
          <div className="mb-8">
            <MdVerified className="mx-auto text-primary-blue mb-4" size={64} />
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to ProductVerify
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              The ultimate platform for product authenticity verification using
              blockchain technology. Connect your wallet to get started.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            <Card className="text-center">
              <FaBoxes className="mx-auto text-blue-500 mb-3" size={32} />
              <h3 className="font-semibold text-gray-900 mb-2">
                Product Registry
              </h3>
              <p className="text-sm text-gray-600">
                Register and track authentic products on the blockchain
              </p>
            </Card>
            <Card className="text-center">
              <AiOutlineSafetyCertificate
                className="mx-auto text-green-500 mb-3"
                size={32}
              />
              <h3 className="font-semibold text-gray-900 mb-2">
                Verification System
              </h3>
              <p className="text-sm text-gray-600">
                Verify product authenticity with cryptographic proof
              </p>
            </Card>
            <Card className="text-center">
              <AiOutlineShop
                className="mx-auto text-purple-500 mb-3"
                size={32}
              />
              <h3 className="font-semibold text-gray-900 mb-2">
                NFT Marketplace
              </h3>
              <p className="text-sm text-gray-600">
                Trade authenticated product NFTs securely
              </p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 p-6 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back,{" "}
          {account
            ? `${account.substring(0, 6)}...${account.substring(
                account.length - 4
              )}`
            : "User"}
        </h1>
        <p className="text-gray-600">
          Here's your product verification dashboard overview
        </p>
      </div>

      {/* Wallet Status */}
      <div className="mb-8">
        <WalletStatus />
      </div>

      {/* Network Setup Guide */}
      <div className="mb-8">
        <NetworkSetupGuide />
      </div>

      {/* Deployment Status */}
      <div className="mb-8">
        <DeploymentStatus />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <Card key={index} className="relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`${stat.color}`}>{stat.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Link key={index} to={action.link}>
              <Card hover className="h-full">
                <div className="text-center">
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-lg text-white mb-3 ${action.color}`}
                  >
                    {action.icon}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* My NFTs Section */}
      <div className="mb-8">
        <MyNFTsSection />
      </div>

      {/* Rewards Section */}
      {(pendingRewards > 0 || totalEarnings > 0) && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Rewards & Earnings
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Claim Rewards */}
            {pendingRewards > 0 && (
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Pending Rewards
                    </h3>
                    <p className="text-2xl font-bold text-green-600">
                      {pendingRewards} AUTH
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Available to claim
                    </p>
                  </div>
                  <Button
                    variant={ButtonVariants.SUCCESS}
                    onClick={handleClaimRewards}
                    disabled={claimingRewards}
                  >
                    {claimingRewards ? "Claiming..." : "Claim Rewards"}
                  </Button>
                </div>
              </Card>
            )}

            {/* Distribution Chart */}
            {distributionShares && (
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">
                  Distribution Overview
                </h3>
                <DistributionChart shares={distributionShares} />
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Loading and Error States */}
      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner message="Loading dashboard data..." />
        </div>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <div className="text-center py-4">
            <p className="text-red-800 font-medium">
              Error loading dashboard data
            </p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <Button
              variant={ButtonVariants.SECONDARY}
              onClick={refreshData}
              className="mt-3"
            >
              Retry
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
