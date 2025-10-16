#!/bin/bash

# Quick Start Script for FeeDistributor
echo "🚀 Starting FeeDistributor Application..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Function to check if port is in use
check_port() {
    lsof -ti:$1 > /dev/null 2>&1
}

# Start Hardhat node if not running
if ! check_port 8545; then
    echo "🔗 Starting Hardhat local blockchain..."
    npx hardhat node > hardhat.log 2>&1 &
    HARDHAT_PID=$!
    echo "Hardhat node started with PID: $HARDHAT_PID"
    
    # Wait for hardhat to start
    echo "⏳ Waiting for blockchain to start..."
    sleep 5
else
    echo "✅ Hardhat node already running on port 8545"
fi

# Deploy contracts
echo "🔧 Deploying contracts..."
npx hardhat run scripts/deploy-with-frontend.js --network localhost

if [ $? -eq 0 ]; then
    echo "✅ Contracts deployed successfully!"
    
    # Start frontend
    echo "🌐 Starting frontend..."
    cd frontend
    
    # Check if frontend port is available
    if check_port 3000; then
        echo "⚠️  Port 3000 is already in use. The frontend may not start."
    fi
    
    npm start
else
    echo "❌ Contract deployment failed!"
    exit 1
fi
