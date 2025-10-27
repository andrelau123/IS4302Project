import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../Common/Card';
import { Button } from '../Common/Button';
import './ContractOverview.css';

const ContractOverview = () => {
  const [selectedContract, setSelectedContract] = useState(null);

  const contracts = [
    {
      name: "ProductRegistry",
      title: "The Digital Inventory and Passport",
      description: "The main database that tracks every authentic item. It records who made it, who owns it now, where it is in the supply chain (Status), and its history (transfers).",
      keyUsers: ["Manufacturers", "Retailers", "Verifiers"],
      features: [
        "Register new products",
        "Track ownership changes",
        "View product history",
        "Update product status",
        "Search products by ID"
      ],
      icon: "📦",
      route: "/product-registry"
    },
    {
      name: "ProductNFT",
      title: "The Digital Certificate of Ownership",
      description: "A unique token (NFT) for a premium product. It proves authenticity and has rules that prevent it from being sold to just anyone, ensuring it stays with authorized partners.",
      keyUsers: ["Customers (Owners)", "Manufacturers", "Marketplaces"],
      features: [
        "Mint product NFTs",
        "Transfer ownership",
        "View NFT metadata",
        "Check authenticity",
        "Browse owned NFTs"
      ],
      icon: "🏆",
      route: "/nfts"
    },
    {
      name: "RetailerRegistry",
      title: "The Retailer Report Card",
      description: "Manages which stores are approved by which brands. It tracks performance data and calculates a Reputation Score (0-1000) for every retailer.",
      keyUsers: ["Brands/Manufacturers", "Retailers"],
      features: [
        "Register retailers",
        "View reputation scores",
        "Track performance metrics",
        "Approve/reject retailers",
        "Update retailer status"
      ],
      icon: "🏪",
      route: "/retailer-registry"
    },
    {
      name: "VerificationManager",
      title: "The Quality Assurance System",
      description: "Organizes and runs verification checks. It manages the pool of Verifiers who must stake AUTH tokens as collateral and collects verification fees.",
      keyUsers: ["Verifiers", "Customers (Requestors)"],
      features: [
        "Request verifications",
        "Stake as verifier",
        "Submit verification results",
        "Track verification history",
        "Claim rewards"
      ],
      icon: "✅",
      route: "/verification-manager"
    },
    {
      name: "OracleIntegration",
      title: "The Consensus Brain",
      description: "Receives signed data from different outside sources and aggregates their verdicts using trust-based Weight to decide if verification has reached sufficient Quorum.",
      keyUsers: ["IoT Sensors", "Human Inspectors", "Verification Manager"],
      features: [
        "Submit attestations",
        "View consensus results",
        "Manage oracle sources",
        "Check quorum status",
        "Aggregate verdicts"
      ],
      icon: "🧠",
      route: "/oracle"
    },
    {
      name: "FeeDistributor",
      title: "The Revenue Splitter",
      description: "Receives all verification fees and automatically splits money into defined shares: Verifier, Brand, and Treasury. Stakeholders must manually claim their share.",
      keyUsers: ["Verifiers", "Brands", "Treasury"],
      features: [
        "View fee distribution",
        "Claim rewards",
        "Update distribution shares",
        "Track revenue history",
        "Manage treasury"
      ],
      icon: "💰",
      route: "/fees"
    },
    {
      name: "AuthToken",
      title: "The Utility Token (AUTH)",
      description: "The project's cryptocurrency used to pay fees, acts as collateral for staking, and gives holders voting power on protocol changes.",
      keyUsers: ["All Participants"],
      features: [
        "Transfer tokens",
        "Stake for verification",
        "Pay fees",
        "View balance",
        "Check allowances"
      ],
      icon: "🪙",
      route: "/fees" // AuthToken features integrated with FeeDistributor
    },
    {
      name: "GovernanceVoting",
      title: "The Decentralized Rulebook (DAO)",
      description: "Allows token holders to create and vote on proposals. Votes are weighted by AUTH tokens held, and proposals pass only with minimum participation.",
      keyUsers: ["AUTH Token Holders", "Proposers"],
      features: [
        "Create proposals",
        "Vote on proposals",
        "View voting history",
        "Check quorum status",
        "Execute proposals"
      ],
      icon: "🗳️",
      route: "/governance"
    },
    {
      name: "DisputeResolution",
      title: "The Court System",
      description: "Allows users to formally challenge product authenticity. Users pay fees and post bonds in AUTH. Arbiters vote to resolve disputes.",
      keyUsers: ["Customers (Initiators)", "Arbiters"],
      features: [
        "File disputes",
        "Vote as arbiter",
        "View dispute history",
        "Claim bonds",
        "Track resolutions"
      ],
      icon: "⚖️",
      route: "/disputes"
    },
    {
      name: "Marketplace",
      title: "The Secondary NFT Exchange",
      description: "A platform where owners can list ProductNFTs for sale using ETH. Handles payments, charges platform fees, and transfers NFTs to buyers.",
      keyUsers: ["NFT Owners (Sellers)", "NFT Buyers", "Platform Owner"],
      features: [
        "List NFTs for sale",
        "Buy listed NFTs",
        "View marketplace listings",
        "Track sales history",
        "Manage fees"
      ],
      icon: "🛒",
      route: "/marketplace"
    }
  ];

  return (
    <div className="contract-overview">
      <div className="overview-header">
        <h1>Supply Chain Authenticity Platform</h1>
        <p>A comprehensive blockchain solution for product authentication and supply chain management</p>
      </div>

      <div className="contracts-grid">
        {contracts.map((contract, index) => (
          <Card 
            key={contract.name} 
            className={`contract-card ${selectedContract === contract.name ? 'selected' : ''}`}
            onClick={() => setSelectedContract(selectedContract === contract.name ? null : contract.name)}
          >
            <div className="contract-header">
              <span className="contract-icon">{contract.icon}</span>
              <h3>{contract.name}</h3>
            </div>
            <h4>{contract.title}</h4>
            <p className="contract-description">{contract.description}</p>
            
            <div className="key-users">
              <strong>Key Users:</strong>
              <div className="users-list">
                {contract.keyUsers.map((user, idx) => (
                  <span key={idx} className="user-tag">{user}</span>
                ))}
              </div>
            </div>

            {selectedContract === contract.name && (
              <div className="contract-details">
                <h5>Available Features:</h5>
                <ul className="features-list">
                  {contract.features.map((feature, idx) => (
                    <li key={idx}>{feature}</li>
                  ))}
                </ul>
                <div className="action-buttons">
                  <Link to={contract.route}>
                    <Button 
                      variant="primary" 
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      Access {contract.name}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="system-flow">
        <h2>System Flow Overview</h2>
        <div className="flow-diagram">
          <div className="flow-step">
            <span className="step-number">1</span>
            <div className="step-content">
              <h4>Product Registration</h4>
              <p>Manufacturers register products in ProductRegistry and mint NFTs</p>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <span className="step-number">2</span>
            <div className="step-content">
              <h4>Retail Authorization</h4>
              <p>Retailers get approved through RetailerRegistry and build reputation</p>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <span className="step-number">3</span>
            <div className="step-content">
              <h4>Verification Process</h4>
              <p>Products verified through VerificationManager with Oracle consensus</p>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <span className="step-number">4</span>
            <div className="step-content">
              <h4>Market Trading</h4>
              <p>Verified NFTs traded on Marketplace with fee distribution</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractOverview;
