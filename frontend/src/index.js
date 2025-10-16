import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { MetaMaskProvider } from "@metamask/sdk-react";

// BigInt polyfill for older browsers
if (typeof BigInt === 'undefined') {
  window.BigInt = function(value) {
    return parseInt(value);
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <MetaMaskProvider
      debug={false}
      sdkOptions={{
        dappMetadata: {
          name: "IS4302 Project - Product Registry & NFT Marketplace",
          url: window.location.href,
        },
        infuraAPIKey: process.env.REACT_APP_INFURA_API_KEY,
      }}
    >
      <App />
    </MetaMaskProvider>
  </React.StrictMode>
);
