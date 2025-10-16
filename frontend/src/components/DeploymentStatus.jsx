import React from 'react';
import { AiOutlineWarning, AiOutlineRocket } from 'react-icons/ai';
import { useWallet } from '../contexts/WalletContext';
import { useContracts } from '../hooks/useContracts';
import Card from './Common/Card';

const DeploymentStatus = () => {
  const { isConnected, isCorrectNetwork } = useWallet();
  const { feeDistributor, authToken } = useContracts();

  const contractsDeployed = feeDistributor && authToken;

  if (!isConnected) {
    return null; // Don't show if wallet isn't connected
  }

  if (contractsDeployed) {
    return (
      <Card className="bg-green-50 border-green-200">
        <div className="flex items-center space-x-3">
          <AiOutlineRocket className="text-green-600" size={24} />
          <div>
            <h3 className="text-sm font-medium text-green-800">
              Smart Contracts Ready
            </h3>
            <p className="text-xs text-green-700">
              All contracts are deployed and ready for interaction
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-yellow-50 border-yellow-200">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <AiOutlineWarning className="text-yellow-600 flex-shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="text-sm font-medium text-yellow-800 mb-1">
              Smart Contracts Not Deployed
            </h3>
            <p className="text-xs text-yellow-700 mb-3">
              The smart contracts haven't been deployed yet. Deploy them to enable full functionality.
            </p>
            
            {!isCorrectNetwork && (
              <p className="text-xs text-yellow-700 mb-3">
                ⚠️ Please ensure you're connected to the Hardhat Local network first.
              </p>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-medium text-yellow-800">To deploy contracts:</h4>
              <ol className="text-xs text-yellow-700 space-y-1 ml-3">
                <li>1. Open a terminal and navigate to the project root</li>
                <li>2. Run: <code className="bg-yellow-100 px-1 rounded">npx hardhat node</code></li>
                <li>3. In another terminal, run: <code className="bg-yellow-100 px-1 rounded">npm run deploy</code></li>
                <li>4. Refresh this page after deployment completes</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default DeploymentStatus;
