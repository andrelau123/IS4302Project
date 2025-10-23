import React, { useState } from 'react';
import { AiOutlineWarning, AiOutlineCopy, AiOutlineCheckCircle } from 'react-icons/ai';
import { useWallet } from '../contexts/WalletContext';
import Card from './Common/Card';
import Button from './Common/Button';
import Modal from './Common/Modal';
import { ButtonVariants } from '../types';
import { toast } from 'react-toastify';

const NetworkSetupGuide = () => {
  const { isConnected, isCorrectNetwork } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const networkDetails = {
    networkName: "IS4302 Hardhat Local",
    rpcUrl: "http://localhost:8545",
    chainId: "31337",
    currencySymbol: "ETH",
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  if (!isConnected) {
    return null;
  }

  if (isCorrectNetwork) {
    return (
      <Card className="bg-green-50 border-green-200">
        <div className="flex items-center space-x-3">
          <AiOutlineCheckCircle className="text-green-600" size={24} />
          <div>
            <h3 className="text-sm font-medium text-green-800">
              Connected to Correct Network
            </h3>
            <p className="text-xs text-green-700">
              You're connected to the Hardhat Local network and ready to go!
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-yellow-50 border-yellow-200">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <AiOutlineWarning className="text-yellow-600 flex-shrink-0 mt-0.5" size={24} />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                Wrong Network Detected
              </h3>
              <p className="text-xs text-yellow-700 mb-3">
                Please manually add the Hardhat Local network to MetaMask.
              </p>
              
              <Button
                variant={ButtonVariants.WARNING}
                onClick={() => setIsModalOpen(true)}
                className="text-xs"
                size="sm"
              >
                Show Setup Instructions
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="MetaMask Network Setup"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">
              📋 Manual Setup Instructions
            </h4>
            <ol className="text-sm text-blue-700 space-y-2">
              <li>1. Open MetaMask extension</li>
              <li>2. Click on the network dropdown (top center)</li>
              <li>3. Click "Add network" → "Add a network manually"</li>
              <li>4. Fill in the details below</li>
              <li>5. Click "Save" and switch to the new network</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-800">Network Details:</h4>
            
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Network Name
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={networkDetails.networkName}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded bg-gray-50"
                  />
                  <Button
                    variant={ButtonVariants.OUTLINE}
                    onClick={() => copyToClipboard(networkDetails.networkName, "Network name")}
                    size="sm"
                  >
                    <AiOutlineCopy size={14} />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  New RPC URL
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={networkDetails.rpcUrl}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded bg-gray-50"
                  />
                  <Button
                    variant={ButtonVariants.OUTLINE}
                    onClick={() => copyToClipboard(networkDetails.rpcUrl, "RPC URL")}
                    size="sm"
                  >
                    <AiOutlineCopy size={14} />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Chain ID
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={networkDetails.chainId}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded bg-gray-50"
                  />
                  <Button
                    variant={ButtonVariants.OUTLINE}
                    onClick={() => copyToClipboard(networkDetails.chainId, "Chain ID")}
                    size="sm"
                  >
                    <AiOutlineCopy size={14} />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Currency Symbol
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={networkDetails.currencySymbol}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded bg-gray-50"
                  />
                  <Button
                    variant={ButtonVariants.OUTLINE}
                    onClick={() => copyToClipboard(networkDetails.currencySymbol, "Currency symbol")}
                    size="sm"
                  >
                    <AiOutlineCopy size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">
              🔑 Test Account Setup (Optional)
            </h4>
            <p className="text-xs text-green-700 mb-2">
              Import a test account with pre-funded ETH:
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
                readOnly
                className="flex-1 px-2 py-1 text-xs border border-green-300 rounded bg-green-50 font-mono"
              />
              <Button
                variant={ButtonVariants.OUTLINE}
                onClick={() => copyToClipboard("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", "Private key")}
                size="sm"
              >
                <AiOutlineCopy size={14} />
              </Button>
            </div>
            <p className="text-xs text-green-600 mt-1">
              In MetaMask: Account menu → Import Account → Private Key
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-700">
              ⚠️ Make sure your Hardhat node is running on localhost:8545 before testing!
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default NetworkSetupGuide;
