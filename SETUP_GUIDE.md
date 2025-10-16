# FeeDistributor Setup Guide

This guide will help you set up and run the complete FeeDistributor application with both smart contracts and frontend.

## Prerequisites

1. **Node.js** (v16 or higher)
2. **npm** or **yarn**
3. **MetaMask** browser extension
4. **Git** (for cloning the repository)

## Quick Start

### 1. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Start Local Blockchain

Open a new terminal and start the Hardhat local blockchain:

```bash
npx hardhat node
```

This will:
- Start a local Ethereum blockchain on `http://127.0.0.1:8545`
- Create 20 test accounts with 10,000 ETH each
- Display the private keys for importing into MetaMask

### 3. Deploy Contracts

In another terminal, deploy the contracts and set up the frontend:

```bash
npx hardhat run scripts/deploy-with-frontend.js --network localhost
```

This will:
- Deploy the AuthToken and FeeDistributor contracts
- Create a frontend `.env` file with contract addresses
- Transfer test tokens to demonstration accounts

### 4. Configure MetaMask

1. **Add Local Network**:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`

2. **Import Test Accounts**:
   - Copy private keys from the Hardhat node output
   - Import them into MetaMask for testing

### 5. Start Frontend

```bash
cd frontend
npm start
```

The frontend will be available at `http://localhost:3000`.

## Application Features

### For All Users
- **Connect Wallet**: Connect MetaMask to the application
- **View Dashboard**: See pending rewards, total earnings, and distribution statistics
- **Claim Rewards**: Withdraw earned rewards in one click
- **Real-time Updates**: Automatic refresh of balances and rewards

### For Distributors
- **Distribute Revenue**: Allocate revenue between verifiers and brands
- **Monitor Distributions**: Track total platform distribution

### For Admins
- **Update Shares**: Modify revenue distribution percentages
- **Manage Roles**: Grant distributor and admin roles
- **Pause/Unpause**: Emergency controls for the contract

## Testing the Application

### 1. Admin Functions

The deployer account has admin and distributor roles by default. You can:

1. **Test Revenue Distribution**:
   - Enter a verifier address (use another imported account)
   - Enter a brand address (use another imported account)
   - Enter an amount (e.g., 100 ETH)
   - Click "Distribute Revenue"

2. **Test Share Updates**:
   - Modify the distribution percentages
   - Ensure they sum to 10,000 (100%)
   - Click "Update Shares"

### 2. User Functions

Switch to other imported accounts to test:

1. **Claim Rewards**:
   - After distributing revenue, switch to verifier/brand accounts
   - View pending rewards on the dashboard
   - Click "Claim Rewards"

2. **View Statistics**:
   - Check total earnings and AUTH token balance
   - View the distribution chart

## Troubleshooting

### Common Issues

1. **MetaMask not connecting**:
   - Ensure you're on the correct network (Hardhat Local)
   - Check that the Hardhat node is running
   - Try refreshing the page

2. **Transactions failing**:
   - Verify you have sufficient ETH for gas fees
   - Check that contract addresses are correct
   - Ensure you have the required role for admin functions

3. **"Contract not found" errors**:
   - Verify the deployment was successful
   - Check that `.env` file contains correct contract addresses
   - Restart the frontend after deployment

4. **Rewards not showing**:
   - Ensure revenue has been distributed to your address
   - Try refreshing the dashboard
   - Check that you're connected with the correct account

### Network Issues

- **Reset Hardhat**: If you encounter issues, stop the node (Ctrl+C) and restart it
- **Clear MetaMask**: Reset account transaction history in MetaMask if needed
- **Redeploy**: Run the deployment script again if contracts seem corrupted

## Development

### Adding New Features

1. **Smart Contract Changes**:
   - Modify contracts in `contracts/`
   - Run tests: `npx hardhat test`
   - Redeploy: `npx hardhat run scripts/deploy-with-frontend.js --network localhost`

2. **Frontend Changes**:
   - Components are in `frontend/src/components/`
   - Hooks for contract interaction: `frontend/src/hooks/`
   - Styling: Individual CSS files per component

### Testing

Run the smart contract tests:
```bash
npx hardhat test
```

### Building for Production

1. **Deploy to Testnet/Mainnet**:
   - Update `hardhat.config.js` with network configuration
   - Deploy: `npx hardhat run scripts/deploy-with-frontend.js --network <network-name>`

2. **Build Frontend**:
   ```bash
   cd frontend
   npm run build
   ```

## Support

For issues or questions:
1. Check this setup guide
2. Review the troubleshooting section
3. Check contract and frontend documentation
4. Verify all prerequisites are met
