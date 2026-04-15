# Polymarket AI-Resolved Prediction Market

A decentralized prediction market platform that pulls real-world event data from Polymarket and resolves markets using AI (OpenAI GPT). Built on X Layer with USDT payouts.

## Features

- **Polymarket Integration**: Fetches live prediction market data from Polymarket API
- **AI Resolution**: Uses OpenAI GPT-4 to resolve markets based on real-world outcomes
- **USDT Payouts**: Winners receive payouts in USDT on X Layer
- **Real-time Updates**: WebSocket-based live market updates
- **Web3 Integration**: MetaMask wallet support with automatic X Layer network switching

## Architecture

### Backend (`/backend`)
- `polymarket-api.js` - Fetches markets from Polymarket API with fallback support
- `ai-resolver.js` - AI-powered market resolution using OpenAI GPT
- `agent.js` - Market creation and resolution orchestration
- `scheduler.js` - Automated market lifecycle management
- `gateway.js` - OKX TEE wallet integration for payouts
- `server.js` - Express + WebSocket server

### Smart Contracts (`/contracts`)
- `PredictionMarket.sol` - On-chain prediction market with:
  - USDT (now upgraded to support USDT) betting
  - AI-verified resolutions with confidence scores
  - 5% protocol fee on loser pool
  - Proportional winner payouts

### Frontend (`/frontend`)
- `app.js` - Web3 integration, market display, betting interface
- Modern UI with category filtering
- Real-time pool visualization

## Quick Start

### Prerequisites
- Node.js 18+
- MetaMask with X Layer network
- OpenAI API key (for AI resolution)
- OKX wallet credentials (for payouts)

### Installation

```bash
npm install
```

### Environment Setup

Create `.env` file:

```env
# Chain Configuration
CHAIN_ID=196
RPC_URL=https://rpc.xlayer.tech

# Token Configuration (USDT on X Layer)
USDT_ADDRESS=0xA5a08660F2A9fE38e5047B53F6f6D87F26E9b03F
USDT_DECIMALS=6

# OpenAI (for AI resolution)
OPENAI_API_KEY=sk-your-key-here

# OKX Wallet (for payouts)
OKX_API_KEY=your-okx-api-key
OKX_SECRET_KEY=your-okx-secret
OKX_PASSPHRASE=your-okx-passphrase
AGENT_WALLET_ADDRESS=your-agent-wallet-address

# Treasury
TREASURY_WALLET=0x5C67869272f3d167c761dBbf0DC3901a1fF214D3

# Market Settings
MIN_BET_USDC=0.50
MAX_BET_USDC=50.00
```

### Running the System

```bash
# Start the server
npm start

# Or directly
node backend/server.js
```

The server will:
1. Connect to Polymarket API
2. Create up to 3 active prediction markets
3. Check for expired markets every 30 seconds
4. Resolve expired markets using AI
5. Process payouts to winners

## API Endpoints

- `GET /api/market` - List active markets
- `GET /api/bets` - List all bets
- `GET /api/history` - List resolved markets
- `POST /api/bet` - Place a bet
- `GET /api/agent-wallet` - Get agent wallet info

## Market Lifecycle

1. **Creation**: System fetches markets from Polymarket API
2. **Betting**: Users place YES/NO bets with USDT
3. **Expiration**: Market reaches end date
4. **Resolution**: AI analyzes and determines outcome
5. **Payout**: Winners claim proportional share of loser pool

## Testing

```bash
# Run system tests
node test-system.js

# Run workflow tests
node test-workflow.js

# Cleanup data
node scripts/cleanup-data.js
```

## Data Structure

### Market Object
```javascript
{
  id: "pm_540819_1776254284826",
  polymarketId: "540819",
  question: "Will Jesus Christ return before GTA VI?",
  description: "...",
  category: "General",
  image: "https://...",
  expiresAt: 1785499200000,
  status: "open", // or "resolving", "resolved"
  yesPool: 0,
  noPool: 0,
  source: "polymarket",
  aiResolution: {
    outcome: "YES",
    confidence: 0.95,
    reasoning: "...",
    resolvedAt: 1234567890
  }
}
```

### Bet Object
```javascript
{
  id: "bet_1776254284861_t39i82",
  wallet: "0x742d35cc...",
  marketId: "pm_540819_1776254284826",
  position: "YES",
  stake: 1.5,
  txHash: "0x...",
  timestamp: 1776254284861
}
```

## Troubleshooting

### Polymarket API 403 Error
The system automatically falls back to sample markets. For production use, consider:
- Implementing API key authentication
- Using a proxy service
- Caching market data

### AI Resolution Not Working
Ensure `OPENAI_API_KEY` is set in your `.env` file. Without it, markets will remain unresolved.

### Payout Issues
Check:
- Agent wallet has sufficient USDT balance
- OKX API credentials are correct
- Session token hasn't expired (in `data/okx_session.json`)

## License

MIT
