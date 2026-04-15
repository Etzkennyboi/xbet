---
name: usdt0-bridge-out
description: "Use this skill specifically when the user wants to bridge USDT0 from X Layer back to Ethereum, or convert USDT0 to USDT. Typical triggers: 'bridge back to Ethereum', 'bridge USDT0 to Ethereum', 'move USDT0 from X Layer', 'convert USDT0 to USDT', 'withdraw USDT0 from X Layer', 'transfer USDT0 Ethereum', 'bridge out', or any intent involving moving USDT0 from X Layer to Ethereum. Direct LayerZero OFT v2 protocol with SGX attestation, DVN validation, LayerZero Scan delivery confirmation, GUID replay protection, 0.5% max slippage enforced in Shared Decimals space. Post-audit v3.0.0 release: all 9 critical bugs fixed."
license: MIT
metadata:
  author: "Antigravity IDE / OnchainOS"
  version: "3.0.0"
  homepage: "https://github.com/Etzkennyboi/main-xlayer-bridge"
---

# Onchain OS Bridge OUT (X Layer → Ethereum)

Bridge USDT0 from X Layer back to Ethereum using LayerZero OFT v2 protocol.

## Pre-flight Checks

Before executing `bridgeOut`, verify:

1. **X Layer RPC endpoint configured and responsive**:
   ```bash
   echo $XLAYER_RPC_URL  # Should return valid RPC URL
   ```

2. **Ethereum RPC endpoint accessible**:
   ```bash
   echo $ETH_RPC_URL  # Should return valid RPC URL
   ```

3. **TEE signer authenticated**:
   ```bash
   onchainos wallet status  # Verify wallet is ready
   ```

4. **User has USDT0 balance on X Layer**:
   ```bash
   onchainos portfolio balance --address <user> --chain xlayer --token usdt0
   ```

5. **SGX enclave is genuine**:
   - Automatic check in Step 2 of execution
   - If fails: ATTESTATION_FAILED error

## Token Details

| Field | Value |
|-------|-------|
| **Source Chain** | X Layer (ChainID 196) |
| **Source Token** | USDT0 (OFT v2) |
| **Source Address** | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| **Destination Chain** | Ethereum (ChainID 1) |
| **Destination Token** | USDT (ERC-20) |
| **Destination Address** | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| **Token Decimals** | 6 (both chains) |

## Command Index

| Command | Signature | Description |
|---------|-----------|-------------|
| 1 | `bridgeOut(amount, toWallet)` | Bridge USDT0 X Layer → USDT Ethereum |
| 2 | `getQuote(amount)` | Get expected output amount + fees |
| 3 | `validateInput(amount, address)` | Pre-flight validation only |

**Legend**:
- `amount`: String in decimal notation (e.g., `"100.5"`)
- `toWallet`: Recipient address (0x... format on Ethereum)

## Bridge OUT Function

### Signature

```typescript
async function bridgeOut(
  amount: string,
  toWallet: string
): Promise<{
  success: boolean,
  data?: {
    txHash: string,
    layerZeroScanUrl: string,
    fromChain: "x-layer",
    toChain: "ethereum",
    token: "USDT",
    amount: string
  },
  error?: string,
  meta?: {
    durationMs: number,
    destinationConfirmedAt: string
  }
}>
```

### Parameters

| Param | Type | Required | Rules |
|-------|------|----------|-------|
| `amount` | string | Yes | Decimal notation, max 6 decimal places, >= 0.000001, any upper limit ok |
| `toWallet` | string | Yes | Valid EVM address (0x... format), 40 hex chars, case-insensitive |

### Return Success

```json
{
  "success": true,
  "data": {
    "txHash": "0xdef456...",
    "layerZeroScanUrl": "https://scan.layerzero-api.com/tx/def456...",
    "fromChain": "x-layer",
    "toChain": "ethereum",
    "token": "USDT",
    "amount": "100.5"
  },
  "meta": {
    "durationMs": 98000,
    "destinationConfirmedAt": "2026-04-10T12:35:40.123Z"
  }
}
```

### Return Errors

See **Error Codes** section below for detailed error handling.

## Skill Routing

### When to Use `bridgeOut`

| User Intent | Use This | NOT This |
|-------------|----------|----------|
| Move USDT0 from X Layer back to Ethereum | ✓ bridgeOut | ✗ bridgeIn |
| Bridge back to Ethereum mainnet | ✓ bridgeOut | ✗ bridgeIn |
| Withdraw USDT0 from X Layer | ✓ bridgeOut | ✗ bridgeIn |
| "Bridge back" (ambiguous) | ✓ bridgeOut (default) | ✗ bridgeIn |
| Send USDT FROM Ethereum TO X Layer | ✗ bridgeOut | ✓ bridgeIn |
| Move USDT0 FROM X Layer TO Ethereum | ✓ bridgeOut | ✗ bridgeIn |

**Default assumption**: If user says "bridge back", "withdraw", or is currently on X Layer, assume `bridgeOut`.

## Execution Flow

### Step 1: Validate Inputs

```
Check: amount is string, numeric, >= 0.000001, <= 6 decimals
Check: toWallet is 0x... format, 40 hex chars
If invalid: return {success: false, error: "INVALID_PARAMETER"}
```

### Step 2: Verify TEE Attestation

```
Check: SGX enclave measurement (MRENCLAVE)
Check: Signer identity (MRSIGNER)
If fails: return {success: false, error: "ATTESTATION_FAILED", code: 2002}
```

### Step 3: Validate LayerZero DVN Configuration

```
Call: getConfig(destEid=30101, CONFIG_TYPE_ULN)
Check: requiredDVN.length > 0
Check: executor != address(0)
If fails: return {success: false, error: "DVN_NOT_CONFIGURED", code: 2003}
```

### Step 4: Get Quote from LayerZero

```
Call: quoteSend({
  dstEid: 30101,
  to: toWallet,
  amountLD: parseUnits(amount, 6),
  minAmountLD: 0,
  extraOptions: "0x",
  composeMsg: "0x"
})
Returns: {amountLD, minAmountLD, msgFee: {nativeFee, lzTokenFee}}
```

### Step 5: Calculate and Validate Slippage

```
minAcceptableSD = (outputAmountSD × (10000 - 50)) / 10000
              = (outputAmountSD × 9950) / 10000
            ≈ outputAmount × 0.995  (0.5% max slippage)

If actualOutput < minAcceptable:
  return {success: false, error: "SLIPPAGE_EXCEEDED", code: 1004}
```

### Step 6: Estimate Gas Dynamically

```
baseGas = 350000  (no longer hardcoded magic number)
gas = (quoteSend.msgFee.nativeFee / gasPrice) + baseGas
gas = gas × 1.2   (20% buffer for safety)
```

### Step 7: Check GUID Uniqueness (Replay Protection)

```
guid = generateGUID(user, nonce)
If seenGuids.has(guid):
  return {success: false, error: "GUID_REPLAY", code: 2004}
seenGuids.add(guid)
```

### Step 8: Verify USDT0 Balance

```
balance = await getBalance(userAddress, "xlayer")
If balance < amount:
  return {success: false, error: "INSUFFICIENT_BALANCE", code: 1003}
```

### Step 9: Setup USDT0 Approval (Reset-to-Zero Pattern)

```
currentAllowance = await getAllowance(userAddress, OFT_ADDRESS)
If currentAllowance > 0:
  1. approve(spender=OFT_ADDRESS, amount=0)
     onchainos wallet contract-call(to=USDT0, data=approval(0))
     Wait for confirmation
  2. approve(spender=OFT_ADDRESS, amount=requiredAmount)
     onchainos wallet contract-call(to=USDT0, data=approval(requiredAmount))
     Wait for confirmation
Else:
  approve(spender=OFT_ADDRESS, amount=requiredAmount)
  onchainos wallet contract-call(to=USDT0, data=approval(requiredAmount))
  Wait for confirmation
```

### Step 10: Execute Bridge Send on X Layer

```
calldata = encodeLayerZeroCall({
  dstEid: 30101,
  to: toWallet,
  amountLD: parseUnits(amount, 6),
  minAmountLD: minAcceptableAmount,
  extraOptions: gasLimit encoded as bytes,
  composeMsg: "0x"
})

onchainos wallet contract-call({
  to: OFT_ADDRESS,
  data: calldata,
  value: msgFee.nativeFee
})

Returns: txHash
```

### Step 11: Wait for X Layer Confirmation

```
Poll: X Layer RPC for tx receipt
Interval: 2 seconds
Max attempts: 30 (1 minute timeout)
Check: receipt.status == 1 (success)

If failed: return {success: false, error: "TX_REVERTED", code: 1006}
If timeout: return {success: false, error: "CONFIRMATION_TIMEOUT"}
```

### Step 12: Poll LayerZero Scan for Destination Confirmation

```
Poll: https://scan.layerzero-api.com/api/tx/{txHash}
Interval: 5 seconds
Max timeout: 120 seconds (2 minutes)

Check: response.destinationTxHash exists AND status == "DELIVERED"

If DELIVERED:
  continue to Step 13
If timeout (>2 min):
  return {success: false, error: "LZ_DELIVERY_TIMEOUT", code: 2001}
  Note: Funds NOT burned — will still arrive
```

### Step 13: Return Success Response

```json
{
  "success": true,
  "data": {
    "txHash": "0x...",
    "layerZeroScanUrl": "https://scan.layerzero-api.com/tx/...",
    "fromChain": "x-layer",
    "toChain": "ethereum",
    "token": "USDT",
    "amount": "100.5"
  },
  "meta": {
    "durationMs": 98000,
    "destinationConfirmedAt": "2026-04-10T12:35:40.123Z"
  }
}
```

## Error Codes

| Code | Name | Cause | Resolution |
|------|------|-------|------------|
| **2002** | ATTESTATION_FAILED | SGX enclave not genuine (MRENCLAVE mismatch) | Verify enclave binary; restart TEE |
| **2003** | DVN_NOT_CONFIGURED | No DVN or executor configured on LayerZero | Wait 5 min; check LayerZero Endpoint config |
| **2001** | LZ_DELIVERY_TIMEOUT | Message not confirmed on Ethereum in 120s | Check LayerZero Scan manually; wait longer |
| **2004** | GUID_REPLAY | GUID already used this session | Restart TEE session |
| **1003** | INSUFFICIENT_BALANCE | USDT0 balance < requested amount | Top up USDT0 on X Layer |
| **1004** | SLIPPAGE_EXCEEDED | Output > 0.5% below expected | Retry with smaller amount |
| **1006** | TX_REVERTED | X Layer transaction rejected on-chain | Check allowance, gas, balance |
| **3002** | CIRCUIT_BREAKER_OPEN | 5+ RPC failures in 60s | Wait 60s; verify RPC endpoints |

## Risk Controls

### Slippage Limit

- **Enforced at**: Step 5 of execution
- **Maximum**: 0.5% (50 basis points)
- **Calculation space**: Shared Decimals (both tokens 6 decimals)
- **Formula**: `actualOutput >= expectedOutput × 0.995`

### Delivery Confirmation

| Aspect | Value |
|--------|-------|
| Polling interval | 5 seconds |
| Max wait time | 120 seconds |
| Success condition | LayerZero Scan status = DELIVERED |
| Failure handling | Return timeout error; funds still in flight |

### DVN Validation

Before any bridge:
1. Verify required DVN addresses exist on LayerZero Endpoint
2. Verify executor address is non-zero
3. Warn user if DVN setup unusual or incomplete

### USDT0 Safety (Reset-to-Zero)

USDT0 (OFT v2) may have similar restrictions. Bridge function:
1. Checks current allowance
2. If > 0: reset to 0 first
3. Then approve required amount
4. Handles both 1 TX and 2 TX cases transparently

## Validation Rules

### Amount Validation

```
✓ Valid: "100.5", "50", "0.000001", "1000000"
✗ Invalid: "-100", "abc", "100.0000001" (7 decimals)
```

### Address Validation

```
✓ Valid: "0xdac17f958d2ee523a2206206994597c13d831ec7" (lowercase)
✓ Valid: "0xdAC17F958D2ee523a2206206994597C13D831ec7" (checksummed)
✗ Invalid: "dac17f...", "0xdac17" (too short), "0x..." (no digits)
```

## Cross-Chain Details

### X Layer → Ethereum Pathway

| Element | Detail |
|---------|--------|
| Source RPC | XLAYER_RPC_URL env var |
| Destination RPC | ETH_RPC_URL env var |
| LayerZero EID (source) | 30274 (X Layer) |
| LayerZero EID (destination) | 30101 (Ethereum) |
| OFT Contract (source) | 0x94bcca6bdfd6a61817ab0e960bfede4984505554 |
| OFT Adapter (destination) | 0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee |

## Edge Cases

### Case 1: Destination Scan Polling Timeout (>2 min)

**Issue**: LayerZero Scan doesn't show DELIVERED status in 120 seconds

**Root Cause**: DVN is processing message (normal), network congestion, or validator queue

**Recovery**:
1. User checks LayerZero Scan URL manually
2. If status = PENDING: Message is processing, wait 30s
3. If status = DELIVERED: Tokens already arrived on Ethereum
4. If not found: Check X Layer txHash was successful first
5. USDT0 will NOT be burned — funds in flight

### Case 2: Multiple Approvals in Succession

**Scenario**: User bridges 100 USDT0, then immediately bridges 50 USDT0 more

**System Behavior**:
- First bridge: approval(100) + send()
- Second bridge: 100 allowance exists → reset(0) + approval(50) + send()
- Result: Both succeed, just 2 TXs for second instead of 1

### Case 3: Very Large Amounts

**Scenario**: User wants to bridge 1,000,000+ USDT0

**System Behavior**:
- Validation passes (no upper limit)
- Quote may return higher fees
- Execution proceeds normally
- Slippage calculated same way

### Case 4: Recipient Address Typo

**Prevention**:
- Bridge always displays recipient before final execution
- Ask: "Confirm sending to **0x1234...abcd** on **Ethereum**?"

**If Executed to Wrong Address**:
- Tokens arrive at typed address (immutable)
- User must contact recipient or bridge back

## Display Rules

| Item | Format | Example |
|------|--------|---------|
| Amounts | Decimal notation, 6 decimals | `"100.5 USDT0"` → `"100.475 USDT"` |
| Gas fees | USD with cents | `"$0.02"`, `"$1.25"` |
| Duration | Human seconds/minutes | `"95 seconds"`, `"2 minutes 30 seconds"` |
| Addresses | Abbreviated with ellipsis | `"0xdAC17F...D831ec7"` |

## Global Notes

- **All signing happens in the TEE enclave** via `onchainos wallet contract-call` — keys never exposed
- **No external APIs** — only direct on-chain RPC calls to X Layer and Ethereum nodes
- **Quote freshness** — If >10 seconds from quote to execution, re-quote to verify slippage
- **Logging** — All events to stderr (structured JSON); stdout JSON responses only
- **Security** — Never log private keys, mnemonics, API keys, or user credentials
- **Idempotency** — GUID + session tracking prevents accidental double-bridges within same TEE session

## Command-Line Usage

```bash
# Quote expected output
onchainos bridge quote --direction out --amount "100.5" --chain xlayer

# Execute full bridge
onchainos bridge execute --direction out --amount "100.5" \
  --recipient "0x1234567890abcdef1234567890abcdef12345678" \
  --wallet "0xabcdef1234567890abcdef1234567890abcdef12"

# Get unsigned calldata only (advanced)
onchainos bridge calldata --direction out --amount "100.5" \
  --recipient "0x1234567890abcdef1234567890abcdef12345678"
```

## References

- **Main SKILL.md**: See `../SKILL.md` for overview + cross-skill workflows
- **Bridge IN**: See `../usdt0-bridge-in/SKILL.md` for reverse direction
- **API Reference**: See `../../docs/API.md` for full type definitions
- **Troubleshooting**: See `../references/troubleshooting.md` for common issues
