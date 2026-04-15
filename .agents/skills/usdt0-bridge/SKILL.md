---
name: usdt0-bridge
description: "Use this skill when the user wants to bridge USDT or USDT0 tokens between Ethereum and X Layer. Typical triggers: 'bridge USDT to X Layer', 'move tokens from Ethereum to X Layer', 'convert USDT to USDT0', 'bridge USDT0 back to Ethereum', 'send USDT across chains', 'transfer to X Layer', 'cross-chain transfer', 'bridge tokens', '跨链转账', '代币桥接', 'LayerZero transfer', 'omnichain send', or mentions transferring assets between Ethereum and X Layer. Supported chains: Ethereum (mainnet), X Layer (ChainID 196). Tokens: USDT on Ethereum, USDT0 on X Layer. Direct LayerZero OFT v2 protocol with SGX attestation, DVN validation, destination confirmation via LayerZero Scan polling, GUID replay protection, 0.5% max slippage enforced in Shared Decimals space. Post-audit certified with 24 total bugs fixed (15 v2, 9 v3). No external bridge APIs — direct on-chain RPC calls only."
license: MIT
metadata:
  author: "Antigravity IDE / OnchainOS"
  version: "3.0.0"
  homepage: "https://github.com/Etzkennyboi/main-xlayer-bridge"
---

# USDT0 Bridge Skills

Cross-chain bridging for USDT (Ethereum) ↔ USDT0 (X Layer) using LayerZero OFT v2 protocol with TEE-native signing via OnchainOS.

## Pre-flight Checks

### Environment Verification

Before bridging, verify:

1. **OnchainOS CLI installed and updated**:
   ```bash
   onchainos --version        # Should be v3.0.0+
   ```

2. **RPC Endpoints configured**:
   ```bash
   echo $ETH_RPC_URL          # Ethereum RPC (required)
   echo $XLAYER_RPC_URL       # X Layer RPC (required)
   ```

3. **TEE Signer ready**:
   ```bash
   onchainos wallet status    # Verify wallet is authenticated
   ```

4. **Network connectivity**: Both RPC endpoints accessible and responding

### Installation

USDT0 Bridge Skills is included with the onchainos-skills package. No separate installation needed.

```bash
# Install or update onchainos (handles all skills)
curl -sSL https://raw.githubusercontent.com/okx/onchainos-skills/main/install.sh | sh

# Verify installation
onchainos --version
onchainos bridge --help
```

## Chain & Network Support

| Chain | ChainID | LZ EID | Token | Decimals |
|-------|---------|--------|-------|----------|
| **Ethereum** | 1 | 30101 | USDT | 6 |
| **X Layer** | 196 | 30274 | USDT0 | 6 |

**Supported wallets**: Any OnchainOS-compatible TEE signer (no hardware wallet support needed — all signing happens in secure enclave).

## Token & Contract Reference

<IMPORTANT>
🚨 **Hardcoded Addresses** — Prevent poison attacks. Never ask user for token addresses.
</IMPORTANT>

| Network | Token | Address | Type |
|---------|-------|---------|------|
| Ethereum | USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | ERC-20 |
| X Layer | USDT0 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | OFT v2 |

**OFT Contracts** (LayerZero message handling):
| Network | Role | Address |
|---------|------|---------|
| Ethereum | OFT Adapter | `0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee` |
| X Layer | OFT | `0x94bcca6bdfd6a61817ab0e960bfede4984505554` |

## Command Index

| # | Command | Description |
|---|---------|-------------|
| 1 | `onchainos bridge quote --direction <in\|out> --amount <amt> --chain <chain>` | Get bridge quote (expected output, fees, slippage) |
| 2 | `onchainos bridge execute --direction <in\|out> --amount <amt> --recipient <addr> --wallet <addr>` | Execute bridge with single-shot approval + send |
| 3 | `onchainos bridge calldata --direction <in\|out> --amount <amt> --recipient <addr>` | Get unsigned calldata only (advanced) |

**Legend**:
- `--direction in` = Ethereum → X Layer (USDT → USDT0)
- `--direction out` = X Layer → Ethereum (USDT0 → USDT)
- `--amount` = Decimal notation (e.g., `"100.5"`)
- `--recipient` = Destination wallet (0x... format)
- `--wallet` = Source wallet (OnchainOS authenticated address)

## Execution Flow

### Bridge IN (Ethereum → X Layer)

**User Request**: "Bridge 100.5 USDT to 0x..."

```
Step 1: Validate inputs
  • Amount: 100.5 (0.000001–unlimited)
  • Recipient: 0x... (valid EVM address on X Layer)

Step 2: Check TEE attestation
  • Verify SGX enclave measurement (MRENCLAVE)
  • Verify signer identity (MRSIGNER)
  • Fail: ATTESTATION_FAILED (2002)

Step 3: Validate LayerZero DVN configuration
  • Check required DVN addresses exist
  • Check executor address non-zero
  • Fail: DVN_NOT_CONFIGURED (2003)

Step 4: Quote expected output
  • Call LayerZero quoteSend()
  • Get: outputAmount, nativeFee, lzTokenFee

Step 5: Validate slippage ≤ 0.5%
  • Convert both amounts to Shared Decimals
  • Calculate: (output / input) × 100
  • Require: >= (100 - maxSlippage)
  • Fail: SLIPPAGE_EXCEEDED (1004)

Step 6: Estimate gas dynamically
  • Use quoteSend() response + 20% buffer
  • Replace hardcoded 350k magic number
  • Calculate final gas limit

Step 7: Check GUID uniqueness
  • Verify GUID not in seenGuids set
  • Fail: GUID_REPLAY (2004)

Step 8: Check USDT balance
  • Fetch balance on Ethereum
  • Require: balance >= amount
  • Fail: INSUFFICIENT_BALANCE (1003)

Step 9: Setup allowance (reset-to-zero pattern)
  • If allowance > 0: reset to 0 first
  • Then: approve required amount
  • USDT safety: prevents "non-zero approval" revert

Step 10: Execute send() on Ethereum
  • onchainos wallet contract-call()
  • Signs transaction inside TEE
  • Broadcasts to Ethereum network
  • Returns txHash

Step 11: Wait for on-chain confirmation
  • Poll Ethereum RPC for receipt (~15 seconds)
  • Verify status = 1 (success)

Step 12: Poll LayerZero Scan for destination
  • Start polling immediately after Step 11
  • Check every 5 seconds
  • Wait for status: "DELIVERED"
  • Max timeout: 2 minutes
  • Fail: LZ_DELIVERY_TIMEOUT (2001)

Step 13: Return success response
  {
    "success": true,
    "data": {
      "txHash": "0x...",
      "layerZeroScanUrl": "https://scan.layerzero-api.com/tx/...",
      "fromChain": "ethereum",
      "toChain": "x-layer",
      "token": "USDT0",
      "amount": "100.5",
    },
    "meta": {
      "durationMs": 95000,
      "destinationConfirmedAt": "2026-04-10T12:34:56.789Z"
    }
  }
```

### Bridge OUT (X Layer → Ethereum)

Same 13-step flow, reverse direction:
- Source: X Layer, token: USDT0
- Destination: Ethereum, token: USDT
- Quote: expected USDT amount received
- Response token field: "USDT"

## Parameters

### Global Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `--direction` | string | Yes | `in` (ETH→XLayer) or `out` (XLayer→ETH) | `--direction in` |
| `--amount` | string | Yes | Transfer amount (decimal notation, 6 decimals max) | `--amount "100.5"` |
| `--recipient` | string | Yes | Destination wallet (0x.. format) | `--recipient "0x1234...abcd"` |
| `--wallet` | string | Yes | Source wallet (authenticated OnchainOS address) | `--wallet "0x..."` |

### Command-Specific

**quote**:
- Returns: expected output, fees, gas estimate, slippage %
- No signing or blockchain transaction
- Read-only quote — safe to call multiple times

**execute**:
- Performs: approval (if needed) → send → confirmation → Scan polling
- Returns: txHash + success status
- Blocks until destination confirmed (max 2 min)

**calldata**:
- Advanced/manual use only
- Returns unsigned transaction data
- Caller must sign + broadcast separately

## Risk Controls

### Slippage

- **Hard Limit**: 0.5% max (MAX_SLIPPAGE_BPS = 50)
- **Calculated in Shared Decimals space**: Both tokens 6 decimals → no conversion
- **Formula**: `minAcceptableSD = (inputSD × (10000 - slippage)) / 10000`
- **Enforcement**: Compare `actualOutputSD ≥ minAcceptableSD` before send()

### Delivery Confirmation

| Item | Spec |
|------|------|
| **Polling interval** | 5 seconds |
| **Max timeout** | 120 seconds (2 minutes) |
| **Target status** | "DELIVERED" on LayerZero Scan |
| **Failure action** | Return timeout error; funds NOT burned |
| **User guidance** | "Message still executing — check Scan manually or wait" |

### DVN & Executor Validation

Before every bridge, validate:

```
1. getConfig(destEid, CONFIG_TYPE_ULN) from OFT contract
2. Verify: requiredDVN.length > 0
3. Verify: executor != address(0)
4. If any check fails: BLOCK bridge, throw DVN_NOT_CONFIGURED
```

### USDT Reset-to-Zero Pattern (FIX-03)

USDT ERC-20 reverts on non-zero approval change. Always:

```
1. if (current_allowance > 0) {
     approve(spender, 0)
     wait for confirmation
   }
2. approve(spender, required_amount)
   wait for confirmation
```

### GUID Replay Protection (BUG-F)

- **Scope**: Per TEE session
- **Tracking**: `seenGuids` Set accumulates during session
- **Check**: `if (seenGuids.has(guid)) throw GUID_REPLAY`
- **Reset**: Restart TEE to clear tracking

### Circuit Breaker (BUG-I)

| Condition | Action |
|-----------|--------|
| 5+ RPC failures in 60s | Open state (block requests) |
| No requests for 60s | Reset state (allow retry) |
| Manual reset | Restart agent / TEE session |

## Cross-Skill Workflows

### Workflow A: Balance Verification Before Bridge

> User: "Bridge my USDT to X Layer"

```
Step 1: Fetch balance
  onchainos portfolio all-balances --address <user> --chains ethereum
  → returns: [{symbol: "USDT", balance: "250.5", ...}]
  
Step 2: Confirm: "You have 250.5 USDT. Bridge how much to X Layer?"
  User: "100 USDT"
  
Step 3: Execute bridge
  onchainos bridge execute --direction in --amount "100" \
    --recipient <user_xlayer_address> --wallet <user_ethereum>
  → {txHash, layerZeroScanUrl, ...}

Step 4: Suggest next steps
  "Bridged 100 USDT0 to X Layer. Check Scan or swap on X Layer?"
```

**Data handoff**:
- Balance from portfolio skill → verify >= bridge amount
- No token address needed (hardcoded)
- Decimals (6) → handled internally by bridge

### Workflow B: Post-Bridge Verification

> After bridging, confirm arrival

```
Step 1: Check destination balance (wait 30 seconds for finality)
  onchainos portfolio all-balances --address <user> --chains xlayer
  → returns: [{symbol: "USDT0", balance: "100.5", ...}]

Step 2: Display confirmation
  "✓ Received 100.5 USDT0 on X Layer"

Step 3: Suggest follow-up
  "Ready to swap on X Layer or bridge back?"
```

## Operation

### Step 1: Identify Intent

User statement → Bridge direction:

| User Says | Direction | Function |
|-----------|-----------|----------|
| "Bridge USDT to X Layer" | `in` | bridgeIn |
| "Bridge back to Ethereum" | `out` | bridgeOut |
| "Move USDT across chains" | `in` (default) | bridgeIn |
| "How do I bridge?" | Unclear | Ask both amount + direction |

### Step 2: Collect Parameters

1. **Direction**: Infer from context, confirm if ambiguous
   - "Bridge to X Layer?" → `in`
   - "Bridge back?" → `out`
   - Unknown → Ask: "Direction: Ethereum→X Layer or X Layer→Ethereum?"

2. **Amount**: Extract from user sentence
   - "Bridge **100 USDT**..." → `"100"`
   - Missing → "How much to bridge?"
   - Invalid (negative, non-numeric, > 6 decimals) → Reprompt

3. **Recipient**: EVM address (0x...)
   - Validate format: starts with `0x`, 40 hex chars after prefix
   - Cross-check: "Sending to **0x1234...abcd** on **X Layer**?"

4. **Wallet**: OnchainOS authenticated wallet
   - Single account → use automatically
   - Multiple → list and ask user to confirm

### Step 3: Pre-Flight Checks

```
1. Verify balance >= amount
   if balance < amount:
     return "Insufficient balance (have X, need Y)"

2. Verify TEE attestation
   if attestation fails:
     return "TEE attestation failed — contact support"

3. Validate DVN configuration
   if DVN missing or executor zero:
     return "LayerZero DVN not configured — wait and retry"
```

### Step 4: Quote & Confirm

```bash
onchainos bridge quote --direction <in|out> --amount "100.5" --chain ethereum
```

Display:
```
Quote Summary
  Expected Output: 100.475 USDT0 (0.025% slippage)
  Gas Fee: ~$0.02
  Estimated Duration: 90-120 seconds
  
Confirm proceed? (yes/no)
```

### Step 5: Execute Bridge

```bash
onchainos bridge execute --direction <in|out> --amount "100.5" \
  --recipient "0x..." --wallet "0x..."
```

Monitor:
1. Local tx on source (Etherscan / X Layer Explorer)
2. LayerZero Scan polling (every 5s, max 120s)
3. Destination confirmation

### Step 6: Report Results

**Success**:
```
✓ Bridge Complete

Amount: 100.5 USDT → USDT0
Source TX: 0x... (View on Etherscan)
LayerZero Scan: https://scan.layerzero-api.com/tx/...
Duration: 95 seconds
Arrived at: 0x... on X Layer
```

**Timeout** (after 2 min):
```
⚠️ Destination Confirmation Timeout

Your message is still being verified by LayerZero DVN.

Check Status: https://scan.layerzero-api.com/tx/...

IMPORTANT: Your USDT will NOT be burned. It will arrive once confirmed.

Refresh Scan in 30 seconds or check back later.
```

**Error** (before sending):
```
✗ Bridge Failed: <error message>

<specific recovery instructions based on error code>
```

## Error Codes

| Code | Name | Cause | Recovery |
|------|------|-------|----------|
| **2002** | ATTESTATION_FAILED | SGX attestation failed or MRENCLAVE mismatch | Restart TEE; verify enclave binary |
| **2003** | DVN_NOT_CONFIGURED | No DVN / Executor for pathway | Configure on LayerZero website; retry in 5 min |
| **2001** | LZ_DELIVERY_TIMEOUT | Destination didn't confirm in 2 min | Check Scan manually; message likely still executing |
| **2004** | GUID_REPLAY | GUID already used in session | Restart TEE session to reset tracking |
| **1003** | INSUFFICIENT_BALANCE | Not enough USDT/USDT0 on source | Top up balance on source chain |
| **1004** | SLIPPAGE_EXCEEDED | Output drops > 0.5% vs quote | Retry with smaller amount or wait for better rate |
| **1006** | TX_REVERTED | Transaction rejected on-chain | Check allowance, balance, gas limit; retry |
| **3002** | CIRCUIT_BREAKER_OPEN | RPC failures (5 in 60s) | Wait 60 sec for breaker reset; check RPC status |

## Edge Cases

### Case 1: Message Stuck on Destination (Not DELIVERED in 2 min)

**Symptom**: LayerZero Scan shows status pending > 2 min

**Likely Cause**: DVN is processing message (normal), network congestion, or DVN delayed

**Resolution**:
1. Wait 30 more seconds, refresh Scan
2. If still pending after 5 min total:
   - Check LayerZero infrastructure status
   - Confirm DVN is active on website
3. USDT will NOT be burned — wait for DVN confirmation
4. Contact support if stuck > 1 hour with txHash

### Case 2: Duplicate Approval TX

**Symptom**: User approves before checking current allowance

**System Behavior**: Auto-detects prior allowance, resets to 0 first, then approves

**Result**: 2 TXs instead of 1 (safe, per USDT spec)

### Case 3: Recipient Address Typo

**Prevention**: Always display recipient address before execution with confirmation prompt

**If Executed**: 
- Tokens arrive at wrong wallet (immutable on blockchain)
- Advise user to contact recipient or bridge back
- Bridge can be reversed via `direction out`

### Case 4: No Quote Available (Zero Liquidity)

**Cause**: LayerZero pricing unavailable (rare)

**Resolution**:
1. Retry in 5 seconds
2. If persists: Try smaller amount
3. If still fails: "Insufficient liquidity — try again later"

## Amount Display Rules

| Item | Format | Example |
|------|--------|---------|
| Input/Output amounts | UI units (6 decimals) | `"100.5 USDT"`, `"100.475 USDT0"` |
| Gas fees | USD with 2 decimals | `"$0.02"`, `"$1.25"` |
| Duration | Human-readable | `"95 seconds"`, `"2 minutes"` |
| Contract addresses | Abbreviated (4...4 + ellipsis) | `"0xdAC17F...D831ec7"` |
| Balance | UI units + USD value | `"250.5 USDT ($250.50)"` |

**Never display raw units** (wei, minimal units) to users.

## Global Notes

- **Signing**: All keys remain in TEE enclave. No key exposure to agent code.
- **Approval**: Always reset-to-zero before new approval on ERC-20 tokens (USDT pattern).
- **Quote freshness**: If >10 seconds between quote and execution, re-quote and compare slippage.
- **Logging**: All events logged to stderr (structured JSON); stdout JSON responses only.
- **Security**: Never log private keys, mnemonics, credentials, or API secrets.
- **Gas estimation**: Dynamic via `quoteSend()` + 20% buffer (replaces hardcoded 350k).
- **Encoding**: All lowercased EVM addresses in internal calls; user-provided addresses checked for valid format.

## Additional Resources

- **API Reference**: [docs/API.md](../docs/API.md) — Full function signatures, types, return fields
- **Security Policy**: [SECURITY.md](../SECURITY.md) — Audit info, CVE reporting, guarantees
- **Changelog**: [CHANGELOG.md](../CHANGELOG.md) — Version history, all bug fixes (v2 + v3)
- **CLI Reference**: [references/cli-reference.md](./references/cli-reference.md) — Full command documentation
- **Troubleshooting**: [references/troubleshooting.md](./references/troubleshooting.md) — Error recovery guides
