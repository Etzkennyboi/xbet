# Chain & Network Support

## Supported Networks

USDT0 Bridge v3.0.0 connects two networks via LayerZero OFT v2 protocol:

### Network Overview

| Network | Chain ID | LayerZero EID | Status | Token | Contract |
|---------|----------|---------------|--------|-------|----------|
| **Ethereum** | 1 | 30101 | ✅ Production | USDT | 0xdAC17F958D2ee523a2206206994597C13D831ec7 |
| **X Layer** | 196 | 30274 | ✅ Production | USDT0 | 0x779Ded0c9e1022225f8E0630b35a9b54bE713736 |

### Network Selection

Bridges are unidirectional — always choose correct direction:

#### Bridge IN (Ethereum → X Layer)

Use when:
- User has USDT on Ethereum
- User wants to move tokens to X Layer
- User wants to convert USDT → USDT0

```
Source: Ethereum (ChainID 1)
  └─ Token: USDT (ERC-20)
  
Destination: X Layer (ChainID 196)
  └─ Token: USDT0 (OFT v2)
```

Command:
```bash
onchainos bridge execute --direction in --amount "100" \
  --recipient <user_on_xlayer> --wallet <user_on_eth>
```

#### Bridge OUT (X Layer → Ethereum)

Use when:
- User has USDT0 on X Layer
- User wants to move tokens back to Ethereum
- User wants to convert USDT0 → USDT

```
Source: X Layer (ChainID 196)
  └─ Token: USDT0 (OFT v2)

Destination: Ethereum (ChainID 1)
  └─ Token: USDT (ERC-20)
```

Command:
```bash
onchainos bridge execute --direction out --amount "100" \
  --recipient <user_on_eth> --wallet <user_on_xlayer>
```

## RPC Endpoints

### Public RPC Endpoints (Free)

#### Ethereum
- **Official Alchemy**: https://eth-mainnet.g.alchemy.com/v2/{API_KEY}
- **Publickit**: https://eth.publicrpc.com
- **Ankr**: https://rpc.ankr.com/eth
- **AllNodes**: https://ethereum-mainnet-rpc.allthatnode.com:8545

#### X Layer
- **OKX Official (Recommended)**: https://rpc1.x.okx.com
- **Backup**: https://rpc2.x.okx.com
- **Other providers**: Check https://chainlist.org/?search=x+layer

### Premium RPC Endpoints (Recommended for Production)

- **Alchemy**: https://www.alchemy.com/ (free tier available)
- **Infura**: https://www.infura.io/ (Ethereum only)
- **QuickNode**: https://www.quicknode.com/ (both chains)

### Configuration

Set environment variables:

```bash
# Add to ~/.bashrc or ~/.zshrc (persists across sessions)
export ETH_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
export XLAYER_RPC_URL="https://rpc1.x.okx.com"

# Or set per-command
ETH_RPC_URL=... XLAYER_RPC_URL=... onchainos bridge execute ...
```

## Network Details

### Ethereum Mainnet

| Property | Value |
|----------|-------|
| **Chain ID** | 1 |
| **LayerZero EID** | 30101 |
| **Currency** | ETH |
| **Block Time** | ~12 seconds |
| **Finality** | ~15 minutes (95 blocks) |
| **USDT Contract** | 0xdAC17F958D2ee523a2206206994597C13D831ec7 |

**Key Facts**:
- Most secure blockchain (most validators)
- Highest gas costs
- OFT Adapter: 0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee
- Bridge confirms on X Layer in ~1-2 minutes

### X Layer Mainnet

| Property | Value |
|----------|-------|
| **Chain ID** | 196 |
| **LayerZero EID** | 30274 |
| **Currency** | OKB |
| **Block Time** | ~5 seconds |
| **Finality** | ~1 minute (12 blocks) |
| **USDT0 Contract** | 0x779Ded0c9e1022225f8E0630b35a9b54bE713736 |

**Key Facts**:
- Faster blocks & finality than Ethereum
- Lower gas costs
- OFT Contract: 0x94bcca6bdfd6a61817ab0e960bfede4984505554
- Bridge confirms on Ethereum in ~1-2 minutes

## Address Format Standards

Both chains use Ethereum-compatible EVM addressing:

### Valid Address Format

```
0x{40 hexadecimal characters}
```

**Examples**:
- Valid: `0xdAC17F958D2ee523a2206206994597C13D831ec7` (checksummed)
- Valid: `0xdac17f958d2ee523a2206206994597c13d831ec7` (lowercase)
- Invalid: `dac17f958d2ee523a2206206994597c13d831ec7` (missing 0x)
- Invalid: `0xdac17f958d2ee523a2206206994597c13d831ec` (too short)

### Address Validation

Bridge functions automatically:
- Accept both checksummed and lowercase addresses
- Reject invalid format with "INVALID_PARAMETER" error
- Never accept hex without "0x" prefix
- Verify address has exactly 20 bytes (40 hex chars)

## Cross-Chain Pathway

### Ethereum → X Layer (Bridge IN)

```
User on Ethereum
     │
     └─ Connect wallet (TEE authenticated)
        │
        └─ Approve USDT to OFT Adapter
           │
           └─ Call send() on OFT Adapter with:
              • amount: 100 USDT
              • dstEid: 30274 (X Layer)
              • to: user's X Layer address
              • nativeFee: ~$0.02–$0.05
              │
              └─ Ethereum confirms (~15s)
                 │
                 └─ LayerZero message sent
                    │
                    └─ DVN validates message
                       │
                       └─ Executor relays to X Layer
                          │
                          └─ X Layer receives 100 USDT0
                             │
                             └─ LayerZero Scan shows DELIVERED (~90–120s)
```

Total time: **90–120 seconds** (worst case)

### X Layer → Ethereum (Bridge OUT)

```
User on X Layer
     │
     └─ Connect wallet (TEE authenticated)
        │
        └─ Approve USDT0 to OFT Contract
           │
           └─ Call send() on OFT Contract with:
              • amount: 100 USDT0
              • dstEid: 30101 (Ethereum)
              • to: user's Ethereum address
              • nativeFee: ~$0.02–$0.10
              │
              └─ X Layer confirms (~5s)
                 │
                 └─ LayerZero message sent
                    │
                    └─ DVN validates message
                       │
                       └─ Executor relays to Ethereum
                          │
                          └─ Ethereum receives 100 USDT
                             │
                             └─ LayerZero Scan shows DELIVERED (~90–120s)
```

Total time: **90–120 seconds** (worst case)

## Gas & Fee Considerations

### Ethereum Fees

| Operation | Gas (wei) | USD (@ 20 gwei) |
|-----------|-----------|--------------|
| USDT Approval | 45,000 | ~$0.90 |
| Bridge send() | 200,000–250,000 | ~$4–$5 |
| LayerZero fee (to X Layer) | N/A (calldata) | ~$0.02–$0.05 |

**Total estimated**: **$5–$6 per bridge**

### X Layer Fees

| Operation | Gas (wei) | OKB (@ 2 wei) |
|-----------|-----------|-------------|
| USDT0 Approval | 45,000 | ~$0.09 |
| Bridge send() | 150,000–200,000 | ~$0.30 |
| LayerZero fee (to Ethereum) | N/A (calldata) | ~$0.05–$0.15 |

**Total estimated**: **$0.40–$0.50 per bridge**

**Note**: Exact fees shown by `onchainos bridge quote` before execution.

## Test & Verification Commands

### Check Ethereum Network

```bash
# Get chain ID
curl -s $ETH_RPC_URL -X POST \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | jq .

# Get latest block
curl -s $ETH_RPC_URL -X POST \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq .

# Check balance
curl -s $ETH_RPC_URL -X POST \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["YOUR_ADDRESS","latest"],"id":1}' | jq .
```

### Check X Layer Network

```bash
# Get chain ID
curl -s $XLAYER_RPC_URL -X POST \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | jq .

# Get latest block
curl -s $XLAYER_RPC_URL -X POST \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq .

# Check OKB balance
curl -s $XLAYER_RPC_URL -X POST \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["YOUR_ADDRESS","latest"],"id":1}' | jq .
```

## Additional Resources

- **LayerZero Endpoints**: https://docs.layerzero.network/docs/evm-guides/lz-endpoints
- **LayerZero Scan**: https://scan.layerzero-api.com/
- **Ethereum Block Explorer**: https://etherscan.io/
- **X Layer Block Explorer**: https://www.okx.com/blockchain/explorer/xlayer
