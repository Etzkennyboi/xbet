# Pre-flight Checks

## Installation & Verification

### 1. Install OnchainOS CLI

```bash
# Latest version (automatic updates)
curl -sSL https://raw.githubusercontent.com/okx/onchainos-skills/main/install.sh | sh

# Verify installation
onchainos --version     # Should be 3.0.0+
onchainos bridge --help # Show bridge commands
```

### 2. Configure RPC Endpoints

Both Ethereum and X Layer RPC endpoints are required:

```bash
# Set environment variables
export ETH_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
export XLAYER_RPC_URL="https://rpc1.x.okx.com"

# Verify connectivity
curl -s ${ETH_RPC_URL} -X POST -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | jq .

curl -s ${XLAYER_RPC_URL} -X POST -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | jq .
```

### 3. Authenticate TEE Wallet

```bash
# Login with OnchainOS
onchainos wallet auth

# Verify wallet is ready
onchainos wallet status

# Expected output:
# {
#   "address": "0x...",
#   "authenticated": true,
#   "enclave": "SGX",
#   "mrenclave": "0x..."
# }
```

### 4. Verify Enclave Authenticity

The TEE will automatically verify SGX measurement during the first bridge attempt:

```
Step 2: Verify SGX Attestation
  • Check: MRENCLAVE = expected hashof(enclave binary)
  • Check: MRSIGNER = signing authority identity
  • If mismatch: ATTESTATION_FAILED (2002) error
```

If you see `ATTESTATION_FAILED`:
1. Ensure you're using official `onchainos-skills` package
2. Verify SGX driver is installed: `ls /dev/isgx` (Linux) or SGX Device Manager (Windows)
3. Restart TEE session: `onchainos wallet restart`
4. Contact support with MRENCLAVE value from error

### 5. Check Token Balances

Before bridging, verify you have sufficient balance:

```bash
# Check USDT on Ethereum
onchainos portfolio balance --address YOUR_ADDRESS --chain ethereum --token usdt

# Check USDT0 on X Layer
onchainos portfolio balance --address YOUR_ADDRESS --chain xlayer --token usdt0
```

## Network Status Verification

### Ethereum Network

```bash
# Check latest block
curl -s ${ETH_RPC_URL} -X POST \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  | jq -r '.result | tonumber' | xargs printf '%d\n'

# Verify network is Mainnet (ChainID 1)
curl -s ${ETH_RPC_URL} -X POST \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  | jq -r '.result | tonumber' | xargs printf '%d\n'
# Should output: 1
```

### X Layer Network

```bash
# Check latest block
curl -s ${XLAYER_RPC_URL} -X POST \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  | jq -r '.result | tonumber' | xargs printf '%d\n'

# Verify network is X Layer (ChainID 196)
curl -s ${XLAYER_RPC_URL} -X POST \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  | jq -r '.result | tonumber' | xargs printf '%d\n'
# Should output: 196
```

## Gas & Fee Estimation

LayerZero Cross-Chain Fees:

| Scenario | Estimated Fee | Varies By |
|----------|---------------|-----------|
| Ethereum → X Layer | $0.01–$0.05 | Network congestion, message size |
| X Layer → Ethereum | $0.02–$0.10 | Ethereum gas prices, network congestion |

**Note**: Exact fees provided by `onchainos bridge quote` command.

## Troubleshooting Common Issues

### Issue: "RPC endpoint not responding"

```
Error: ECONNREFUSED or timeout
```

**Fix**:
1. Verify RPC URL is correct: `echo $ETH_RPC_URL`
2. Test connectivity: `curl -s $ETH_RPC_URL -X POST ... | jq .`
3. Switch to backup RPC if primary is down
4. Check internet connection

### Issue: "TEE wallet not authenticated"

```
Error: onchainos wallet status returns authenticated: false
```

**Fix**:
1. Re-authenticate: `onchainos wallet auth`
2. Verify SGX driver: `ls /dev/isgx` (Linux)
3. Restart TEE service: `systemctl restart onchainos` (if available)
4. Contact support if persists

### Issue: "Circuit breaker open"

```
Error: CIRCUIT_BREAKER_OPEN (3002)
```

**Fix**:
1. Wait 60 seconds for breaker to reset
2. Verify RPC endpoints are responding
3. Check network connectivity
4. Retry after cooldown period

## Security Checklist

Before any bridge transaction:

- [ ] Verify RPC endpoints are from official sources (Alchemy, Infura, OKX public)
- [ ] Verify recipient address matches user intent (copy-paste, don't type)
- [ ] Confirm amount is correct (small test first recommended)
- [ ] Ensure device is not compromised (run antivirus scan if uncertain)
- [ ] Never share private keys even with support staff
- [ ] Double-check contract addresses are hardcoded (user cannot input)

## Additional Resources

- **Chain Support**: See [chain-support.md](./chain-support.md) for detailed network info
- **Attestation Details**: See [attestation.md](./attestation.md) for SGX verification process
- **LayerZero Docs**: https://docs.layerzero.network/
- **OKX Official**: https://www.okx.com/
