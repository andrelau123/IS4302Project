import React from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { formatAddress } from '../../utils/formatters';
import './Header.css';

const Header = () => {
  const { account, isConnected, connectWallet, disconnectWallet, isConnecting } = useWallet();

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <h1>FeeDistributor</h1>
            <span className="subtitle">Decentralized Revenue Distribution</span>
          </div>
          
          <div className="wallet-section">
            {isConnected ? (
              <div className="wallet-info">
                <span className="wallet-address">
                  Connected: {formatAddress(account)}
                </span>
                <button
                  className="btn btn-warning"
                  onClick={disconnectWallet}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                onClick={connectWallet}
                disabled={isConnecting}
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
