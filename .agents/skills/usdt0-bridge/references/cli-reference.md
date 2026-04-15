# CLI Reference

Complete command-line reference for USDT0 Bridge v3.0.0 commands.

## Overview

All bridge commands follow this pattern:

```bash
onchainos bridge <command> [options]
```

## Commands

### 1. quote

Get a quote for what you'll receive when bridging.

**Syntax**:
```bash
onchainos bridge quote \
  --direction <in|out> \
  --amount <string> \
  --chain <ethereum|xlayer>
```

**Parameters**:
| Parameter | Required | Type | Description | Example |
|-----------|----------|------|-------------|---------|
| `--direction` | Yes | string | `in` (ETH→XLayer) or `out` (XLayer→ETH) | `--direction in` |
| `--amount` | Yes | string | Amount to bridge (decimal notation, 6 decimals max) | `--amount "100.5"` |
| `--chain` | Yes | string | Source chain | `--chain ethereum` |

**Output**:
```json
{
  "success": true,
  "data": {
    "inputAmount": "100.5",
    "outputAmount": "100.475",
    "slippagePercent": 0.025,
    "nativeFee": {
      "amountUSD": "$0.035",
      "amountWei": "123456789"
    },
    "gasEstimate": "250000",
    "estimatedDuration": 95000
  }
}
```

**Examples**:
```bash
# Quote for bridging 100 USDT Ethereum → X Layer
onchainos bridge quote --direction in --amount "100" --chain ethereum

# Quote for bridging back 100 USDT0 X Layer → Ethereum
onchainos bridge quote --direction out --amount "100" --chain xlayer
```

### 2. execute

Execute a full bridge transaction (approval + send + confirmation).

**Syntax**:
```bash
onchainos bridge execute \
  --direction <in|out> \
  --amount <string> \
  --recipient <address> \
  --wallet <address>
```

**Parameters**:
| Parameter | Required | Type | Description | Example |
|-----------|----------|------|-------------|---------|
| `--direction` | Yes | string | `in` or `out` | `--direction in` |
| `--amount` | Yes | string | Amount in decimal notation (6 decimals max) | `--amount "100.5"` |
| `--recipient` | Yes | string | Destination address (0x... format) | `--recipient "0x..."` |
| `--wallet` | Yes | string | Source wallet address (0x... format) | `--wallet "0x..."` |

**Output** (Success):
```json
{
  "success": true,
  "data": {
    "txHash": "0xabc123def456...",
    "layerZeroScanUrl": "https://scan.layerzero-api.com/tx/abc123...",
    "fromChain": "ethereum",
    "toChain": "x-layer",
    "token": "USDT0",
    "amount": "100.5"
  },
  "meta": {
    "durationMs": 95000,
    "destinationConfirmedAt": "2026-04-10T12:34:56.789Z"
  }
}
```

**Output** (Error):
```json
{
  "success": false,
  "error": "SLIPPAGE_EXCEEDED",
  "code": 1004,
  "message": "Expected output dropped more than 0.5% — please try again or reduce amount"
}
```

**Examples**:
```bash
# Bridge 100 USDT from Ethereum to X Layer
onchainos bridge execute \
  --direction in \
  --amount "100" \
  --recipient "0xaabbccddeeff00112233445566778899aabbccdd" \
  --wallet "0x1122334455667788990011223344556677889900"

# Bridge 50 USDT0 back from X Layer to Ethereum
onchainos bridge execute \
  --direction out \
  --amount "50" \
  --recipient "0x1122334455667788990011223344556677889900" \
  --wallet "0xaabbccddeeff00112233445566778899aabbccdd"
```

### 3. calldata

Generate unsigned bridge calldata (advanced / manual signing).

**Syntax**:
```bash
onchainos bridge calldata \
  --direction <in|out> \
  --amount <string> \
  --recipient <address>
```

**Parameters**:
| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `--direction` | Yes | string | `in` or `out` |
| `--amount` | Yes | string | Amount (decimal notation, 6 decimals max) |
| `--recipient` | Yes | string | Destination address (0x... format) |

**Output**:
```json
{
  "success": true,
  "data": {
    "to": "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
    "calldata": "0xaabbccdd...",
    "value": "0",
    "gasEstimate": "250000"
  }
}
```

**Notes**:
- Use this only if you're building custom signing logic
- You must manually broadcast the transaction after signing
- No confirmation polling — you handle verification

## Global Options

All commands support:

| Option | Type | Description |
|--------|------|-------------|
| `--help` | flag | Show help for this command |
| `--verbose` | flag | Enable verbose logging |
| `--json` | flag | Force JSON output (default) |
| `--timeout <ms>` | number | Set execution timeout (default: 120000ms) |

**Examples**:
```bash
# Show help
onchainos bridge execute --help

# Verbose output
onchainos bridge execute --verbose --direction in ...

# Custom timeout
onchainos bridge execute --timeout 180000 --direction in ...
```

## Environment Variables

The following environment variables configure bridge behavior:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `ETH_RPC_URL` | Yes | Ethereum RPC endpoint | `https://eth.alchemy.com/...` |
| `XLAYER_RPC_URL` | Yes | X Layer RPC endpoint | `https://rpc1.x.okx.com` |
| `ONCHAINOS_LOG_LEVEL` | No | Logging level (debug, info, warn, error) | `info` |
| `ONCHAINOS_TEE_TIMEOUT` | No | TEE request timeout (ms) | `30000` |

**Setup**:
```bash
# Add to ~/.bashrc or ~/.zshrc
export ETH_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
export XLAYER_RPC_URL="https://rpc1.x.okx.com"
export ONCHAINOS_LOG_LEVEL="info"

# Or set per-command
ETH_RPC_URL=... XLAYER_RPC_URL=... onchainos bridge execute ...
```

## Exit Codes

| Code | Meaning | Example |
|------|---------|---------|
| `0` | Success | Bridge completed |
| `1` | General error | Invalid parameters |
| `2` | Network error | RPC unreachable |
| `3` | TEE error | Attestation failed |
| `4` | Insufficient funds | Not enough USDT/USDT0 |

## Error Handling

All errors return JSON with structure:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "code": 12345,
  "message": "Human-readable error description",
  "details": {
    "field": "additional context"
  }
}
```

**Common Errors**:

| Error | Code | Cause | Recovery |
|-------|------|-------|----------|
| `ATTESTATION_FAILED` | 2002 | SGX attestation failed | Restart TEE, update onchainos |
| `DVN_NOT_CONFIGURED` | 2003 | LayerZero DVN missing | Wait 5 min, retry |
| `LZ_DELIVERY_TIMEOUT` | 2001 | Destination didn't confirm | Check Scan manually, wait longer |
| `GUID_REPLAY` | 2004 | GUID already used | Restart TEE session |
| `INSUFFICIENT_BALANCE` | 1003 | Not enough tokens | Top up balance |
| `SLIPPAGE_EXCEEDED` | 1004 | Output > 0.5% below expected | Retry with smaller amount |

## Scripting & Automation

### Bash Example

```bash
#!/bin/bash

AMOUNT="100"
RECIPIENT="0x..."
WALLET="0x..."

# Quote
QUOTE=$(onchainos bridge quote --direction in --amount "$AMOUNT" --chain ethereum)
OUTPUT=$(echo "$QUOTE" | jq -r '.data.outputAmount')
DURATION=$(echo "$QUOTE" | jq -r '.data.estimatedDuration')

echo "Expected: $OUTPUT USDT0"
echo "Duration: $DURATION ms"

# Execute
RESULT=$(onchainos bridge execute \
  --direction in \
  --amount "$AMOUNT" \
  --recipient "$RECIPIENT" \
  --wallet "$WALLET")

if [ "$(echo "$RESULT" | jq -r '.success')" = "true" ]; then
  TXHASH=$(echo "$RESULT" | jq -r '.data.txHash')
  SCAN_URL=$(echo "$RESULT" | jq -r '.data.layerZeroScanUrl')
  echo "✓ Complete: $SCAN_URL"
else
  ERROR=$(echo "$RESULT" | jq -r '.error')
  MESSAGE=$(echo "$RESULT" | jq -r '.message')
  echo "✗ Failed: $ERROR - $MESSAGE"
  exit 1
fi
```

### Python Example

```python
import subprocess
import json

def bridge(direction, amount, recipient, wallet):
    cmd = [
        "onchainos", "bridge", "execute",
        "--direction", direction,
        "--amount", str(amount),
        "--recipient", recipient,
        "--wallet", wallet
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    
    if data["success"]:
        print(f"✓ Bridge complete: {data['data']['txHash']}")
        return data["data"]
    else:
        raise Exception(f"{data['error']}: {data['message']}")

# Usage
result = bridge("in", "100", "0x...", "0x...")
print(f"Scan: {result['layerZeroScanUrl']}")
```

## Debugging

### Enable Verbose Logging

```bash
ONCHAINOS_LOG_LEVEL=debug onchainos bridge execute ...
```

Will output:
- TEE initialization
- RPC requests/responses
- Approval transactions
- Quote details
- Scan polling attempts

### Check Recent Transactions

```bash
# View last 10 bridge transactions
onchainos bridge history --limit 10

# Export to CSV
onchainos bridge history --format csv > bridges.csv
```

### Simulate (Dry Run)

```bash
# Quote without executing (safe)
onchainos bridge quote --direction in --amount "100" --chain ethereum

# No transaction sent, no funds moved
```

## FAQ

**Q: Can I bridge partial amounts?**  
A: Yes. Any amount >= 0.000001 USDT/USDT0 is valid, but recommend > LayerZero fees (~$0.01).

**Q: Does `--wallet` need to match my authenticated wallet?**  
A: No, you can bridge on behalf of any wallet, but you must be authenticated in TEE.

**Q: How do I know if bridge succeeded?**  
A: Check `success: true` in response, or verify on LayerZero Scan URL.

**Q: Can I cancel a bridge?**  
A: No. Once signed and broadcast, it's immutable on blockchain. Wait for completion or handle on destination if stuck.
