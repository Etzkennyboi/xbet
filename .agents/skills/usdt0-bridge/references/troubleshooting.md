# Troubleshooting Guide

Comprehensive troubleshooting for USDT0 Bridge v3.0.0 errors and issues.

## Error Code Quick Reference

| Code | Name | Severity | Solution |
|------|------|----------|----------|
| 2002 | ATTESTATION_FAILED | 🔴 CRITICAL | Update / restart TEE |
| 2003 | DVN_NOT_CONFIGURED | 🔴 CRITICAL | Configure LayerZero DVN |
| 2001 | LZ_DELIVERY_TIMEOUT | 🟠 HIGH | Check Scan manually, wait |
| 2004 | GUID_REPLAY | 🟠 HIGH | Restart TEE session |
| 1003 | INSUFFICIENT_BALANCE | 🟡 MEDIUM | Top up balance |
| 1004 | SLIPPAGE_EXCEEDED | 🟡 MEDIUM | Retry with smaller amount |
| 1006 | TX_REVERTED | 🟡 MEDIUM | Check allowance, gas |
| 3002 | CIRCUIT_BREAKER_OPEN | 🔵 LOW | Wait 60 seconds |

---

## Error 2002: ATTESTATION_FAILED

### Description
SGX enclave attestation failed or MRENCLAVE mismatch. The bridge will not sign transactions.

### Root Causes

1. **Outdated OnchainOS version**
   ```bash
   # Check version
   onchainos --version
   # Should be 3.0.0 or higher
   ```
   **Fix**: Update
   ```bash
   curl -sSL https://raw.githubusercontent.com/okx/onchainos-skills/main/install.sh | sh
   ```

2. **Corrupted binary**
   ```bash
   # Reinstall
   rm -rf ~/.onchainos ~/.config/onchainos
   curl -sSL https://...install.sh | sh
   ```

3. **SGX driver not installed or outdated**
   ```bash
   # Check Linux
   ls -la /dev/isgx
   # Should exist
   
   # Install: https://github.com/intel/linux-sgx-driver
   ```

4. **SGX disabled in BIOS**
   - Restart computer
   - Enter BIOS (F2, DEL, or other)
   - Find "Intel SGX" setting
   - Enable and save
   - Restart OS

5. **Running in VM without SGX support**
   - SGX cannot work in Virtual Machine on some hypervisors
   - Requires physical hardware with SGX

6. **Enclave tampering detected**
   - Run antivirus scan
   - Reinstall OnchainOS completely
   - Consider hardware compromised if persists

### Step-by-Step Recovery

```bash
# 1. Check CPU supports SGX
grep -o 'sgx' /proc/cpuinfo | sort | uniq    # Linux
# Should output: sgx

# 2. Update version
onchainos --version
# If < 3.0.0: reinstall

# 3. Restart TEE
onchainos wallet restart

# 4. Try bridge again
onchainos bridge execute --direction in ...

# 5. If still failing, check BIOS
# (restart computer and check BIOS settings for SGX)

# 6. Reinstall completely if all else fails
rm -rf ~/.onchainos ~/.config/onchainos
curl -sSL https://...install.sh | sh
onchainos wallet auth
onchainos bridge execute ...
```

### When to Contact Support

Provide:
- Output of `onchainos --version`
- Output of `grep -o 'sgx' /proc/cpuinfo` (Linux) or Windows SGX info
- Output of `onchainos wallet status` (if available)
- CPU model and OS

---

## Error 2003: DVN_NOT_CONFIGURED

### Description
LayerZero DVN (Decentralized Verifier Network) or Executor is not configured for the pathway.

### Root Causes

1. **LayerZero Endpoint misconfigured**
   - DVN addresses not set
   - Executor address is zero
   - Recent LayerZero upgrade

2. **Network change** (unlikely)
   - LayerZero mainnet updated
   - New executor deployment

### Recovery Steps

```bash
# 1. Check LayerZero Endpoint configuration
# (automated inside bridge, but can inspect here)

# 2. This usually resolves itself in 5 minutes
# Try again after 5 minutes

# 3. If persists, verify chain connectivity
echo $ETH_RPC_URL
echo $XLAYER_RPC_URL

# Test RPC
curl -s $ETH_RPC_URL -X POST \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq .

# 4. Check LayerZero website for notifications
# https://twitter.com/LayerZero_Labs
```

### When to Escalate

If error persists after:
- 30 minutes wait
- Verified RPC endpoints working
- Confirmed chain connectivity

Contact support with:
- Timestamp of attempts
- RPC endpoints being used
- Latest `onchainos --version`

---

## Error 2001: LZ_DELIVERY_TIMEOUT

### Description
LayerZero message was sent but destination didn't confirm within 120 seconds.

### Root Causes

1. **Normal delay** (most common — 80% of cases)
   - DVN is processing message
   - Network congestion on destination chain
   - Executor queue backlog

2. **Network outage** (rare)
   - Destination chain temporarily down
   - LayerZero infrastructure issue

3. **Invalid message path** (very rare)
   - DVN not configured properly (but would fail earlier)
   - Executor timeout

### Recovery Steps

```bash
# 1. Get LayerZero Scan URL from response
# Extract from error: layerZeroScanUrl field

# 2. Check Scan manually
# Open: https://scan.layerzero-api.com/tx/{txHash}

# Check status:
# ✓ DELIVERED → Tokens arrived! (delay is ok)
# ⏳ PENDING → Still processing (wait 30 more seconds)
# ✗ FAILED → Message failed (rare, contact support)

# 3. Wait 30 more seconds, refresh Scan

# 4. If DELIVERED after >2 min → Bridge succeeded!
#    Bridge timeout is conservative (2 min), message may take longer

# 5. Check destination balance
# If balance increased → All good, bridge succeeded despite timeout

onchainos portfolio balance --address <user> --chain xlayer --token usdt0

# 6. If balance didn't increase after 5 minutes
# Contact LayerZero + provide:
# - TX hash
# - Scan URL
# - Destination chain + block height
```

### FAQ

**Q: Are my tokens burned?**  
A: **NO**. Tokens are in-flight, not burned. Will arrive when confirmed.

**Q: How long can it take?**  
A: Usually 90-120 seconds. Sometimes can be 5-10 minutes during congestion.

**Q: What if it never arrives?**  
A: LayerZero has <0.01% non-delivery rate. Contact support with full details if >1 hour.

---

## Error 2004: GUID_REPLAY

### Description
Same GUID (Globally Unique ID) was used twice in same TEE session. Bridge has built-in replay protection.

### Root Causes

1. **Accidental double-bridge**
   - Called bridge execute twice with same wallet/params in quick succession
   - Second call rejected by replay protection (intentional safety feature)

2. **Exception/retry loop**
   - First bridge call failed (network error)
   - User retried immediately
   - GUID not regenerated

### Recovery

```bash
# 1. Restart TEE session
onchainos wallet restart

# 2. Retry bridge
onchainos bridge execute --direction in --amount "100" ...

# This generates a NEW GUID, allowing the bridge
```

### Prevention

- Don't call bridge execute twice in rapid succession
- Wait for first call to complete (error or success)
- If uncertain, check balance to see if first call went through

---

## Error 1003: INSUFFICIENT_BALANCE

### Description
Source wallet doesn't have enough USDT or USDT0.

### Root Causes

1. **Insufficient USDT/USDT0**
   - Requesting more than available balance
   - Balance is lower than perceived

2. **Wrong chain**
   - Have balance on Ethereum, tried to bridge OUT from X Layer
   - Have balance on X Layer, tried to bridge IN from Ethereum

3. **Pending transactions**
   - Just spent tokens but balance cache not updated

### Recovery Steps

```bash
# 1. Check balance on correct chain
# For bridge IN (ETH → XLayer), check Ethereum USDT:
onchainos portfolio balance --address <user> --chain ethereum --token usdt

# For bridge OUT (XLayer → ETH), check X Layer USDT0:
onchainos portfolio balance --address <user> --chain xlayer --token usdt0

# 2. If balance insufficient, top up
# Go to exchange or receive from friend

# 3. If balance looks wrong, refresh
onchainos portfolio refresh --address <user>

# Wait 30 seconds for cache to update

# 4. Try bridge again
onchainos bridge execute --direction in --amount "100" ...
```

### Important

- Bridge amount must be <= current balance
- Amount should be > LayerZero fees (~$0.01)
- For bridge IN: Ethereum USDT balance matters
- For bridge OUT: X Layer USDT0 balance matters

---

## Error 1004: SLIPPAGE_EXCEEDED

### Description
Destination amount dropped more than 0.5% from quote due to price movement or network changes.

### Root Causes

1. **Price movement** (most common)
   - > 10 seconds between quote and execution
   - Liquidity changed during execution

2. **Network congestion**
   - Quote became stale while user was approving
   - Rate updated unfavorably

3. **Quote expires**
   - Quote valid for ~10 seconds
   - If execution takes longer, re-quote required

### Recovery Steps

```bash
# 1. Get fresh quote
onchainos bridge quote --direction in --amount "100" --chain ethereum

# Check slippage % (should be <0.5%)

# 2. Immediately execute (within 10 seconds)
onchainos bridge execute --direction in --amount "100" ...

# Don't delay between quote and execute

# 3. If error persists, try smaller amount
# Smaller amounts sometimes have better slippage
onchainos bridge quote --direction in --amount "50" --chain ethereum

onchainos bridge execute --direction in --amount "50" ...

# 4. If still failing, wait for better market conditions
# Slippage rules ensure safety, not a bug
# Better to fail than accept > 0.5% slippage
```

### Note

- 0.5% max slippage is a **safety feature**
- Hard-coded limit prevents surprises
- If slippage exceeds limit, accept and retry
- Not a system error, market condition

---

## Error 1006: TX_REVERTED

### Description
On-chain transaction was rejected (reverted) by smart contract.

### Root Causes

1. **Insufficient allowance**
   - USDT/USDT0 approval not set or expired
   - Wrong approver/spender

2. **Insufficient gas**
   - Gas estimation was wrong
   - Network congestion increased gas needs

3. **Balance changed**
   - Token balance decreased after quote
   - Other transaction consumed balance

4. **Contract error**
   - OFT contract rejected for technical reason
   - DVN/Executor configuration issue

### Recovery Steps

```bash
# 1. Verify balance still sufficient
onchainos portfolio balance --address <user> --chain ethereum --token usdt

# 2. Check allowance is set
# (Bridge usually handles this automatically)
# But if you see TX_REVERTED, try manual approval:

# Get quote to see required amount
onchainos bridge quote --direction in --amount "100" --chain ethereum

# 3. Reset allowance (important: reset to 0 first)
# This is done automatically, but in case:

# 4. Try smaller amount
onchainos bridge execute --direction in --amount "50" ...

# 5. If persists, check RPC endpoint
echo $ETH_RPC_URL

# Try different RPC provider if primary is unreliable
export ETH_RPC_URL="https://rpc.ankr.com/eth"
onchainos bridge execute ...

# 6. Check gas prices
# If network congestion, add buffer or retry later
```

### Debugging TX Revert

```bash
# Get the TX hash from any error message
# Check on Etherscan: https://etherscan.io/tx/{txHash}

# Look for error reason:
# - "ERC20: insufficient allowance"
# - "ERC20: transfer amount exceeds balance"
# - "out of gas"
# - etc.
```

---

## Error 3002: CIRCUIT_BREAKER_OPEN

### Description
Too many RPC failures (5+) in 60 seconds. Circuit breaker triggered to prevent cascading failures.

### Root Causes

1. **RPC endpoint down/unreliable**
   - Network issue
   - RPC provider maintenance
   - Rate limiting

2. **Network connectivity**
   - Internet outage
   - Firewall blocking RPC

3. **RPC overloaded**
   - Too many requests
   - Provider quota exceeded

### Recovery Steps

```bash
# 1. Wait 60 seconds for breaker to reset
sleep 60

# 2. Retry
onchainos bridge execute --direction in --amount "100" ...

# 3. If fails again, check RPC endpoint
curl -s $ETH_RPC_URL -X POST \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | jq .

# Should return chainId: 1 (not error)

# 4. Switch to different RPC provider
export ETH_RPC_URL="https://rpc.ankr.com/eth"
# or
export ETH_RPC_URL="https://eth.publicrpc.com"

onchainos bridge execute ...

# 5. Approve and restart TEE
onchainos wallet restart

onchainos bridge execute ...

# 6. Check network
ping google.com
# Verify internet working
```

### Selecting Better RPC

If your RPC keeps failing, use:

**Free tier** (good for testing):
- Alchemy: https://eth-mainnet.g.alchemy.com/v2/{FREE_API_KEY}
- Publickit: https://eth.publicrpc.com
- Ankr: https://rpc.ankr.com/eth

**Premium** (recommended for production):
- Alchemy (paid): https://www.alchemy.com/
- QuickNode: https://www.quicknode.com/
- Infura: https://www.infura.io/

---

## General Troubleshooting

### Bridge seems to hang

```bash
# Check logs in verbose mode
ONCHAINOS_LOG_LEVEL=debug onchainos bridge execute ...

# See exactly what's being done (RPC calls, etc)
```

### Wrong Wallet Connected

```bash
# Check authenticated wallet
onchainos wallet status | grep address

# Logout and re-auth if needed
onchainos wallet logout
onchainos wallet auth
```

### Lost TX Hash

```bash
# View recent transactions
onchainos bridge history --limit 10

# Find the TX hash there
```

### Bridge "succeeded" but no tokens arrived

```bash
# Check LayerZero Scan
# https://scan.layerzero-api.com/

# Look for your TX hash
# If DELIVERED, tokens arrived (may take 5-10 min)
# If PENDING, still being processed
# If FAILED, contact support

# Double-check balance on destination
onchainos portfolio balance --address <user> --chain xlayer --token usdt0
```

---

## FAQ

**Q: How long should a bridge take?**  
A: 90-120 seconds typically. Can be up to 5-10 minutes during network congestion.

**Q: Can I speed up the bridge?**  
A: No. LayerZero messaging takes time for DVN validation. Not adjustable.

**Q: Are my tokens safe during bridge?**  
A: Yes. Tokens are in-flight using LayerZero's secure messaging. Zero loss risk.

**Q: What if I can't find my TX?**  
A: Check LayerZero Scan directly with TX hash (from error or `bridge history`).

**Q: Can I bridge directly between wallets?**  
A: Yes. Provide any `--recipient` address on destination chain.

---

## Advanced Debugging

### Standalone RPC Tests

```bash
# Test Ethereum RPC
curl -s https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY -X POST -d '{
  "jsonrpc": "2.0",
  "method": "eth_getBalance",
  "params": ["0xdac17f958d2ee523a2206206994597c13d831ec7", "latest"],
  "id": 1
}' | jq .

# Test X Layer RPC
curl -s https://rpc1.x.okx.com -X POST -d '{
  "jsonrpc": "2.0",
  "method": "eth_getBalance",
  "params": ["0x779ded0c9e1022225f8e0630b35a9b54be713736", "latest"],
  "id": 1
}' | jq .
```

### Check Smart Contract State

```bash
# Get USDT balance of user
cast balance <user_address> -e 6 --rpc-url $ETH_RPC_URL

# Get USDT0 balance of user
cast balance <user_address> -e 6 --rpc-url $XLAYER_RPC_URL
```

(Requires `cast` from https://book.getfoundry.sh/)

### Enable Maximum Logging

```bash
ONCHAINOS_LOG_LEVEL=debug \
  onchainos bridge execute \
  --direction in \
  --amount "100" \
  --recipient "0x..." \
  --wallet "0x..." \
  2>&1 | tee bridge.log

# View logs
cat bridge.log
```

---

## Still Having Issues?

Contact support with:
1. **Error code** (2002, 1004, etc)
2. **TX hash** (from response or `bridge history`)
3. **LayerZero Scan URL** (from response)
4. **Output of**: `onchainos --version`
5. **Output of**: `onchainos wallet status`
6. **RPC endpoints** being used
7. **Timestamps** of bridge attempts
8. **Exact command** that failed

Email: support@anticravity.ai  
Docs: https://github.com/Etzkennyboi/main-xlayer-bridge
