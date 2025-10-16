import React, { createContext, useContext } from 'react';
import useWalletHook from '../hooks/useWallet';

const WalletContext = createContext();

export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return context;
};

// Keep the original useWallet export for backward compatibility
export const useWallet = () => {
  return useWalletContext();
};

export const WalletProvider = ({ children }) => {
  const walletData = useWalletHook();

  return (
    <WalletContext.Provider value={walletData}>
      {children}
    </WalletContext.Provider>
  );
};
