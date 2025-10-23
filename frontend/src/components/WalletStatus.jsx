import React, { useState } from 'react';
import { 
  AiOutlineWallet, 
  AiOutlineCopy, 
  AiOutlineReload,
  AiOutlineDisconnect,
  AiOutlineWarning,
  AiOutlineCheckCircle 
} from 'react-icons/ai';
import { FaNetworkWired } from 'react-icons/fa';
import { useWallet } from '../contexts/WalletContext';
import Button from './Common/Button';
import Modal from './Common/Modal';
import { ButtonVariants } from '../types';
import { toast } from 'react-toastify';

const WalletStatus = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    currentAccount,
    balance,
    isConnected,
    isConnecting,
    isCorrectNetwork,
    chainId,
    connectWallet,
    disconnectWallet,
    switchToHardhatNetwork,
    refreshBalance,
    formatAddress
  } = useWallet();

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Address copied to clipboard!');
  };

  const getNetworkName = (chainId) => {
    switch (chainId) {
      case '0x7A69':
      case '31337':
        return 'Hardhat Local';
      case '0x1':
        return 'Ethereum Mainnet';
      case '0x5':
        return 'Goerli Testnet';
      case '0xAA36A7':
        return 'Sepolia Testnet';
      default:
        return `Chain ${chainId}`;
    }
  };

  const getNetworkColor = () => {
    if (isCorrectNetwork) return 'text-green-600 bg-green-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Wallet Connection
            </h3>
            <p className="text-gray-600 text-sm">
              Connect your MetaMask wallet to interact with the IS4302 Project
            </p>
          </div>
          <Button
            variant={ButtonVariants.PRIMARY}
            onClick={connectWallet}
            disabled={isConnecting}
            className="flex items-center space-x-2"
          >
            <AiOutlineWallet size={20} />
            <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Wallet Connected
          </h3>
          <div className="flex items-center space-x-2">
            <Button
              variant={ButtonVariants.OUTLINE}
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-1 text-sm"
            >
              <AiOutlineWallet size={16} />
              <span>Details</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Account Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Account</span>
              <button
                onClick={() => copyToClipboard(currentAccount)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <AiOutlineCopy size={16} />
              </button>
            </div>
            <p className="text-lg font-mono text-gray-900">
              {formatAddress(currentAccount)}
            </p>
          </div>

          {/* Balance Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Balance</span>
              <button
                onClick={refreshBalance}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <AiOutlineReload size={16} />
              </button>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {balance} ETH
            </p>
          </div>

          {/* Network Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Network</span>
              {isCorrectNetwork ? (
                <AiOutlineCheckCircle className="text-green-600" size={16} />
              ) : (
                <AiOutlineWarning className="text-yellow-600" size={16} />
              )}
            </div>
            <p className={`text-sm font-medium px-2 py-1 rounded ${getNetworkColor()}`}>
              {getNetworkName(chainId)}
            </p>
            {!isCorrectNetwork && (
              <Button
                variant={ButtonVariants.WARNING}
                onClick={switchToHardhatNetwork}
                className="w-full mt-2 text-xs"
                size="sm"
              >
                Switch to Hardhat
              </Button>
            )}
          </div>
        </div>

        {!isCorrectNetwork && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AiOutlineWarning className="text-yellow-600" size={20} />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Wrong Network Detected
                </p>
                <p className="text-xs text-yellow-700">
                  Please switch to Hardhat Local network for full functionality
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wallet Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Wallet Details"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Address
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={currentAccount}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
              />
              <Button
                variant={ButtonVariants.OUTLINE}
                onClick={() => copyToClipboard(currentAccount)}
                className="flex items-center space-x-1"
                size="sm"
              >
                <AiOutlineCopy size={16} />
                <span>Copy</span>
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Balance
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-semibold">{balance} ETH</span>
              <Button
                variant={ButtonVariants.OUTLINE}
                onClick={refreshBalance}
                className="flex items-center space-x-1"
                size="sm"
              >
                <AiOutlineReload size={16} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Network
            </label>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded text-sm ${getNetworkColor()}`}>
                {getNetworkName(chainId)} (Chain ID: {chainId})
              </span>
              {!isCorrectNetwork && (
                <Button
                  variant={ButtonVariants.WARNING}
                  onClick={switchToHardhatNetwork}
                  className="flex items-center space-x-1"
                  size="sm"
                >
                  <FaNetworkWired size={16} />
                  <span>Switch Network</span>
                </Button>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <Button
              variant={ButtonVariants.DANGER}
              onClick={() => {
                disconnectWallet();
                setIsModalOpen(false);
              }}
              className="w-full flex items-center justify-center space-x-2"
            >
              <AiOutlineDisconnect size={20} />
              <span>Disconnect Wallet</span>
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default WalletStatus;
