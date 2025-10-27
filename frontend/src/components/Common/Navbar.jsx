import React, { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  AiOutlineWallet, 
  AiOutlineMenu, 
  AiOutlineClose,
  AiOutlineShop,
  AiOutlineSafetyCertificate,
  AiOutlineUser,
  AiOutlineBarChart,
  AiOutlineWarning,
  AiOutlineLeft,
  AiOutlineRight
} from 'react-icons/ai';
import { FaBoxes, FaNetworkWired } from 'react-icons/fa';
import { MdVerified } from 'react-icons/md';
import Button from './Button';
import { useWallet } from '../../contexts/WalletContext';
import { ButtonVariants } from '../../types';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const navRef = useRef(null);
  
  const { 
    connectWallet, 
    disconnectWallet, 
    currentAccount, 
    isConnecting, 
    balance,
    isCorrectNetwork,
    switchToHardhatNetwork,
    formatAddress
  } = useWallet();
  const location = useLocation();

  const navigationItems = [
    {
      path: '/',
      label: 'Dashboard',
      icon: <AiOutlineBarChart size={20} />
    },
    {
      path: '/overview',
      label: 'System Overview',
      icon: <MdVerified size={20} />
    },
    // Core marketplace functionality
    {
      path: '/products',
      label: 'Products',
      icon: <FaBoxes size={20} />
    },
    {
      path: '/marketplace',
      label: 'Marketplace',
      icon: <AiOutlineShop size={20} />
    },
    {
      path: '/nfts',
      label: 'Product NFTs',
      icon: <AiOutlineSafetyCertificate size={20} />
    },
    // Contract management interfaces
    {
      path: '/product-registry',
      label: 'Product Registry',
      icon: <FaBoxes size={20} />
    },
    {
      path: '/retailer-registry',
      label: 'Retailer Registry',
      icon: <AiOutlineUser size={20} />
    },
    {
      path: '/verification-manager',
      label: 'Verification',
      icon: <AiOutlineSafetyCertificate size={20} />
    },
    // Governance and system
    {
      path: '/governance',
      label: 'Governance',
      icon: <AiOutlineBarChart size={20} />
    },
    {
      path: '/disputes',
      label: 'Disputes',
      icon: <AiOutlineWarning size={20} />
    },
    {
      path: '/oracle',
      label: 'Oracle Data',
      icon: <FaNetworkWired size={20} />
    },
    {
      path: '/fees',
      label: 'Fee Distribution',
      icon: <AiOutlineWallet size={20} />
    },
    // Legacy pages (keeping for compatibility)
    {
      path: '/verification',
      label: 'Legacy Verification',
      icon: <AiOutlineSafetyCertificate size={20} />
    },
    {
      path: '/retailers',
      label: 'Legacy Retailers',
      icon: <AiOutlineUser size={20} />
    }
  ];

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const scrollLeft = () => {
    if (navRef.current) {
      navRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (navRef.current) {
      navRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const checkScrollButtons = () => {
    if (navRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  React.useEffect(() => {
    const nav = navRef.current;
    if (nav) {
      nav.addEventListener('scroll', checkScrollButtons);
      checkScrollButtons(); // Initial check
      
      // Check on resize
      const handleResize = () => setTimeout(checkScrollButtons, 100);
      window.addEventListener('resize', handleResize);
      
      return () => {
        nav.removeEventListener('scroll', checkScrollButtons);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  const formatBalance = (balance) => {
    if (!balance) return '';
    const numBalance = parseFloat(balance);
    return numBalance.toFixed(4);
  };

  const handleWalletAction = () => {
    if (currentAccount) {
      disconnectWallet();
    } else {
      connectWallet();
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <MdVerified className="text-primary-blue" size={32} />
              <span className="text-xl font-bold text-gray-900">
                ProductVerify
              </span>
            </Link>
          </div>

          {/* Desktop Navigation - Scrollable */}
          <div className="hidden md:flex items-center flex-1 max-w-full overflow-hidden relative">
            {/* Left scroll button */}
            {showLeftScroll && (
              <button
                onClick={scrollLeft}
                className="absolute left-0 z-10 bg-white shadow-md rounded-full p-1 text-gray-600 hover:text-primary-blue transition-colors duration-200"
                style={{ marginLeft: '4px' }}
              >
                <AiOutlineLeft size={16} />
              </button>
            )}
            
            <div 
              ref={navRef}
              className="flex items-center space-x-2 overflow-x-auto scrollbar-hide px-8 py-2" 
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {navigationItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 whitespace-nowrap min-w-max ${
                    isActive(item.path)
                      ? 'text-primary-blue bg-blue-50 border-b-2 border-primary-blue'
                      : 'text-gray-700 hover:text-primary-blue hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
            
            {/* Right scroll button */}
            {showRightScroll && (
              <button
                onClick={scrollRight}
                className="absolute right-0 z-10 bg-white shadow-md rounded-full p-1 text-gray-600 hover:text-primary-blue transition-colors duration-200"
                style={{ marginRight: '4px' }}
              >
                <AiOutlineRight size={16} />
              </button>
            )}
          </div>

          {/* Wallet Section */}
          <div className="flex items-center space-x-4">
            {/* Network Status */}
            {currentAccount && !isCorrectNetwork && (
              <div className="hidden sm:flex items-center space-x-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                <AiOutlineWarning size={14} />
                <span>Wrong Network</span>
              </div>
            )}
            
            {currentAccount && (
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
                <span className="font-medium">{formatAddress(currentAccount)}</span>
                {balance && (
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {formatBalance(balance)} ETH
                  </span>
                )}
              </div>
            )}
            
            {/* Network Switch Button */}
            {currentAccount && !isCorrectNetwork && (
              <Button
                variant={ButtonVariants.WARNING}
                onClick={switchToHardhatNetwork}
                className="flex items-center space-x-1 text-xs"
                size="sm"
              >
                <FaNetworkWired size={14} />
                <span className="hidden sm:inline">Switch Network</span>
              </Button>
            )}
            
            <Button
              variant={currentAccount ? ButtonVariants.SUCCESS : ButtonVariants.PRIMARY}
              onClick={handleWalletAction}
              disabled={isConnecting}
              className="flex items-center space-x-2"
            >
              <AiOutlineWallet size={20} />
              <span className="hidden sm:inline">
                {isConnecting 
                  ? 'Connecting...' 
                  : currentAccount 
                    ? 'Disconnect' 
                    : 'Connect Wallet'
                }
              </span>
            </Button>

            {/* Mobile menu button */}
            <button
              onClick={toggleMenu}
              className="md:hidden p-2 rounded-md text-gray-700 hover:text-primary-blue hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-blue"
            >
              {isMenuOpen ? <AiOutlineClose size={24} /> : <AiOutlineMenu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                  isActive(item.path)
                    ? 'text-primary-blue bg-blue-50'
                    : 'text-gray-700 hover:text-primary-blue hover:bg-gray-50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
            
            {/* Mobile wallet info */}
            {currentAccount && (
              <div className="px-3 py-2 border-t border-gray-200 mt-3">
                <div className="text-sm text-gray-600">
                  <div className="font-medium">{formatAddress(currentAccount)}</div>
                  {balance && (
                    <div className="text-xs text-gray-500 mt-1">
                      Balance: {formatBalance(balance)} ETH
                    </div>
                  )}
                  {!isCorrectNetwork && (
                    <div className="text-xs text-yellow-600 mt-1 flex items-center space-x-1">
                      <AiOutlineWarning size={12} />
                      <span>Wrong network - Switch to Hardhat Local</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
