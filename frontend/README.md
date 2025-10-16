# FeeDistributor Frontend

A React-based frontend application for the FeeDistributor smart contract system, enabling decentralized revenue distribution among verifiers, brands, and treasury.

## Features

- **Wallet Integration**: Connect with MetaMask and other Ethereum wallets
- **Dashboard**: View pending rewards, total earnings, and distribution statistics
- **Reward Claiming**: Easy one-click reward claiming for verifiers and brands
- **Admin Panel**: Administrative functions for managing distribution shares and revenue distribution
- **Real-time Updates**: Automatic data refresh and real-time balance updates
- **Responsive Design**: Mobile-friendly interface

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask or compatible Ethereum wallet
- Running Hardhat local network with deployed contracts

## Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment configuration:
```bash
cp .env.example .env
```

4. Update the `.env` file with your deployed contract addresses:
```
REACT_APP_FEE_DISTRIBUTOR_ADDRESS=0x...
REACT_APP_AUTH_TOKEN_ADDRESS=0x...
```

## Usage

### Development

Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`.

### Production Build

Create a production build:
```bash
npm run build
```

## Configuration

### Contract Addresses

Update the contract addresses in `src/utils/constants.js`:

```javascript
export const CONTRACT_ADDRESSES = {
  FEE_DISTRIBUTOR: '0x...', // Your deployed FeeDistributor address
  AUTH_TOKEN: '0x...', // Your deployed AuthToken address
};
```

### Network Configuration

The app is configured for Hardhat local network by default. To use other networks, update the network configuration in `src/utils/constants.js`.

## Features Overview

### Dashboard
- **Pending Rewards**: Shows claimable rewards for the connected wallet
- **Total Earnings**: Displays lifetime earnings from the platform
- **Auth Token Balance**: Current AUTH token balance
- **Total Distributed**: Platform-wide distribution statistics
- **Distribution Chart**: Visual representation of revenue sharing

### Wallet Integration
- Connect/disconnect wallet functionality
- Account change detection
- Network switching support
- Transaction status tracking

### Admin Features
- **Revenue Distribution**: Distribute revenue to verifiers and brands
- **Share Management**: Update distribution percentages
- **Role-based Access**: Different permissions for admins and distributors

### User Features
- **Reward Claiming**: One-click reward claiming
- **Real-time Updates**: Automatic balance and reward updates
- **Transaction History**: View recent transactions

## Smart Contract Integration

The frontend integrates with the following smart contracts:

- **FeeDistributor**: Main contract for revenue distribution
- **AuthToken**: ERC20 token used for payments and rewards

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── Common/         # Shared components
│   └── Dashboard/      # Dashboard-specific components
├── contexts/           # React contexts
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
└── contracts/          # Contract ABIs
```

### Key Components

- `WalletContext`: Manages wallet connection and state
- `useFeeDistributor`: Custom hook for contract interactions
- `Dashboard`: Main application interface
- `AdminPanel`: Administrative functions

## Troubleshooting

### Common Issues

1. **Contract not found**: Ensure contract addresses are correctly set
2. **Wallet connection fails**: Check MetaMask is installed and network is correct
3. **Transaction fails**: Verify wallet has sufficient funds and correct permissions

### Network Issues

- Ensure you're connected to the correct network (Hardhat local: Chain ID 31337)
- Check that the Hardhat node is running
- Verify contract deployments

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
