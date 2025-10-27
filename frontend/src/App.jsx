import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { WalletProvider } from "./contexts/WalletContext";
import Navbar from "./components/Common/Navbar";
import Dashboard from "./components/Dashboard/Dashboard";
import ContractOverview from "./components/Dashboard/ContractOverview";
import ProductsPage from "./pages/ProductsPage";
import ProductRegistryPage from "./pages/ProductRegistryPage";
import MarketplacePage from "./pages/MarketplacePage";
import VerificationPage from "./pages/VerificationPage";
import RetailersPage from "./pages/RetailersPage";

// New comprehensive contract components
import ProductRegistryPanel from "./components/ProductRegistry/ProductRegistryPanel";
import RetailerRegistryPanel from "./components/RetailerRegistry/RetailerRegistryPanel";
import GovernanceVotingPanel from "./components/GovernanceVoting/GovernanceVotingPanel";
import DisputeResolutionPanel from "./components/DisputeResolution/DisputeResolutionPanel";
import VerificationManagerPanel from "./components/VerificationManager/VerificationManagerPanel";
import OracleIntegrationPanel from "./components/OracleIntegration/OracleIntegrationPanel";
import FeeDistributorPanel from "./components/FeeDistributor/FeeDistributorPanel";
import ProductNFTPanel from "./components/ProductNFT/ProductNFTPanel";

import "./App.css";

function App() {
  return (
    <WalletProvider>
      <Router>
        <div className="App min-h-screen bg-background-main">
          <Navbar />

          <main className="relative">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/overview" element={<ContractOverview />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/productregistry" element={<ProductRegistryPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/verification" element={<VerificationPage />} />
              <Route path="/retailers" element={<RetailersPage />} />
              
              {/* New comprehensive contract interfaces */}
              <Route path="/product-registry" element={
                <div className="pt-20 p-6 max-w-7xl mx-auto">
                  <ProductRegistryPanel />
                </div>
              } />
              <Route path="/retailer-registry" element={
                <div className="pt-20 p-6 max-w-7xl mx-auto">
                  <RetailerRegistryPanel />
                </div>
              } />
              <Route path="/governance" element={
                <div className="pt-20 p-6 max-w-7xl mx-auto">
                  <GovernanceVotingPanel />
                </div>
              } />
              <Route path="/disputes" element={
                <div className="pt-20 p-6 max-w-7xl mx-auto">
                  <DisputeResolutionPanel />
                </div>
              } />
              <Route path="/verification-manager" element={
                <div className="pt-20 p-6 max-w-7xl mx-auto">
                  <VerificationManagerPanel />
                </div>
              } />
              <Route path="/oracle" element={
                <div className="pt-20 p-6 max-w-7xl mx-auto">
                  <OracleIntegrationPanel />
                </div>
              } />
              <Route path="/fees" element={
                <div className="pt-20 p-6 max-w-7xl mx-auto">
                  <FeeDistributorPanel />
                </div>
              } />
              <Route path="/nfts" element={
                <div className="pt-20 p-6 max-w-7xl mx-auto">
                  <ProductNFTPanel />
                </div>
              } />
              
              {/* Fallback route */}
              <Route
                path="*"
                element={
                  <div className="pt-20 p-6 max-w-7xl mx-auto">
                    <div className="text-center py-20">
                      <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        Page Not Found
                      </h1>
                      <p className="text-gray-600">
                        The page you're looking for doesn't exist.
                      </p>
                    </div>
                  </div>
                }
              />
            </Routes>
          </main>

          {/* Toast notifications */}
          <ToastContainer
            position="bottom-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </div>
      </Router>
    </WalletProvider>
  );
}

export default App;
