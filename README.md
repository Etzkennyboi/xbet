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
