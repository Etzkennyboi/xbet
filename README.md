<<<<<<< HEAD
# CryptoCall — AI-Powered Prediction Market on X Layer

An AI-powered prediction market where users bet USDC on crypto price movements. Built on X Layer blockchain with smart contracts handling all payments.

## Features

- AI agent creates prediction markets based on live OKX prices
- Users pay $0.50 USDC to enter markets via smart contract
- Winners receive proportional payouts from the loser pool
- Automatic market resolution when time expires
- 5% protocol fee goes to treasury

## Quick Start

### 1. Prerequisites

- Node.js 18+
- MetaMask wallet with X Layer network
- USDC on X Layer
- Private key with some OKB for gas

### 2. Install Dependencies

```bash
cd cryptocall_production
npm install
```

### 3. Configure Environment

Edit `.env` file:

```env
# REQUIRED: Your deployer private key (with 0x prefix)
PRIVATE_KEY=0xyour_private_key_here

# REQUIRED: Deployed contract address (after deployment)
CONTRACT_ADDRESS=your_contract_address_here

# Optional: Custom RPC (defaults provided)
RPC_URL=https://rpc.xlayer.tech

# Optional: Treasury address
TREASURY_WALLET=0x5C67869272f3d167c761dBbf0DC3901a1fF214D3
```

### 4. Deploy Contract

```bash
npm run compile
npm run deploy:contract
```

Copy the contract address from the output.

### 5. Update Frontend Config

Edit `frontend/app.js`:
```javascript
const CONFIG = {
  // ...
  CONTRACT_ADDRESS: 'YOUR_DEPLOYED_ADDRESS_HERE',
  // ...
};
```

### 6. Start Application

```bash
npm start
```

Open `http://localhost:3000` in your browser.

## Project Structure

```
cryptocall_production/
├── contracts/
│   └── PredictionMarket.sol    # Smart contract
├── frontend/
│   ├── index.html              # UI
│   ├── style.css               # Styling
│   └── app.js                  # Web3 integration
├── backend/
│   ├── server.js               # Express server
│   ├── agent.js                # AI market creation
│   ├── market-api.js           # OKX price fetching
│   └── scheduler.js            # Cron jobs
├── config.js                    # Shared configuration
├── hardhat.config.js            # Hardhat setup
└── .env                         # Environment variables
```

## How It Works

1. **Market Creation**: AI agent runs at 9AM Lagos time, creates 3 prediction markets based on current prices
2. **Betting**: Users connect MetaMask, approve USDC, pay $0.50 to enter YES or NO
3. **Resolution**: Every 5 minutes, scheduler checks expired markets and resolves them
4. **Payouts**: Winners call `claimWinnings()` to receive their share

## Smart Contract

- **Entry Fee**: $0.50 USDC (500000 wei)
- **Protocol Fee**: 5% of loser pool
- **Payout**: Loser pool distributed proportionally to winners

## Deployment Commands

```bash
# Compile contracts
npm run compile

# Deploy to X Layer
npm run deploy:contract

# Start backend
npm start
```

## Troubleshooting

**"Wrong Network" error?**
- Switch MetaMask to X Layer (Chain ID: 196)
- Click "Switch to X Layer" button in app

**Transactions failing?**
- Check USDC balance
- Check OKB balance for gas
- Verify contract address is correct

**Markets not loading?**
- Backend needs NVIDIA API key for AI
- Markets will use fallback data if AI unavailable
=======
# XBounty: Autonomous Bounty Verification Agent

XBounty is a decentralized bounty platform where an AI agent autonomously verifies on-chain tasks on X Layer and triggers instant payouts.

## 🚀 Quick Start (Development)

1.  **Backend SETUP**:
    ```bash
    npm install
    # Create a .env file based on the environment variables needed
    npm start
    ```

2.  **Frontend SETUP**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

## 🏗️ Deployment: Single-Endpoint (Recommended)
This project is now configured for a **Unified Deployment**. Your backend will build and serve your frontend from a single server. This avoids CORS issues and keeps everything on one URL.

### One-Click Deploy (Render / Railway / Fly.io)
1.  **Connect your GitHub repo**.
2.  **Build Command**: `npm run build`
3.  **Start Command**: `npm start`
4.  **Add Environment Variables**:
    *   `PORT`: `3001`
    *   (All other variables from your `.env`)

### Docker Deployment (Enterprise)
If you have Docker, simply run:
```bash
docker build -t xbounty .
docker run -p 3001:3001 --env-file .env xbounty
```

## 🔐 Environment Variables
Ensure the following are set in your production environment:
- `OKX_API_KEY`: Your OKX API Key
- `OKX_SECRET_KEY`: Your OKX Secret Key
- `OKX_PASSPHRASE`: Your OKX Passphrase
- `AGENT_WALLET_ADDRESS`: Your agent's payout wallet
- `DEEPSEEK_API_KEY`: For AI verification
- `DEEPSEEK_BASE_URL`: (Optional) Custom endpoint
- `VITE_API_URL`: (Frontend only) Your backend API URL

## 📂 Project Structure
- `/src`: Backend Express server and AI logic.
- `/frontend`: Vite + React frontend application.
- `package.json`: Root package manages backend and build scripts.
>>>>>>> 085eac40714c874d43f20d6df62345631223d861
