import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { WalletProvider } from './contexts/WalletContext';
import Navbar from './components/Common/Navbar';
import Dashboard from './components/Dashboard/Dashboard';
import ProductsPage from './pages/ProductsPage';
import MarketplacePage from './pages/MarketplacePage';

import './App.css';

function App() {
  return (
    <WalletProvider>
      <Router>
        <div className="App min-h-screen bg-background-main">
          <Navbar />
          
          <main className="relative">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/verification" element={
                <div className="pt-20 p-6 max-w-7xl mx-auto">
                  <div className="text-center py-20">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">Verification Center</h1>
                    <p className="text-gray-600">Product verification functionality coming soon...</p>
                  </div>
                </div>
              } />
              <Route path="/retailers" element={
                <div className="pt-20 p-6 max-w-7xl mx-auto">
                  <div className="text-center py-20">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">Retailer Registry</h1>
                    <p className="text-gray-600">Retailer management functionality coming soon...</p>
                  </div>
                </div>
              } />
              {/* Fallback route */}
              <Route path="*" element={
                <div className="pt-20 p-6 max-w-7xl mx-auto">
                  <div className="text-center py-20">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">Page Not Found</h1>
                    <p className="text-gray-600">The page you're looking for doesn't exist.</p>
                  </div>
                </div>
              } />
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
