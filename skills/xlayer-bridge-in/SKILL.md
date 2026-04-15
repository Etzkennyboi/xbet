# Skill: xlayer-bridge-in

**Category**: DeFi / Cross-Chain  
**Chains**: Ethereum (1), Base (8453) → X Layer (196)  
**Tokens**: USDC  
**Complexity**: Medium  
**Risk Level**: Medium (requires token approval)

## Description

Bridge USDC from Ethereum or Base to X Layer using Owlto Finance. Automatically handles ERC-20 approvals, gas estimation, and slippage protection. Runs in TEE environment with injected signer.

## When to Use

- Move USDC to X Layer for trading or DeFi
- Top up agent's X Layer balance
- Rebalance assets across chains
- Prepare funds for X Layer operations

## Prerequisites

### Technical Requirements
- TEE environment with `__TEE_SIGNER__` injected  
  *If not available, see Fix #2: OKX OS Integration Helper*
- Sufficient USDC balance on source chain
- Sufficient ETH (Ethereum/Base) for gas fees

### Required Permissions  
This skill requires Antigravity TEE permissions. To authorize:

1. Go to **Antigravity IDE** in your OKX wallet
2. Navigate to **Skills → xlayer-bridge-in**
3. Click **Settings** → **Request Permissions**
4. Approve these permissions:
   - ✓ TEE Signer Access (required)
   - ✓ Chain RPC Access (Ethereum, Base)
   - ✓ Contract Interaction (ERC-20 approval, bridge execution)

### Without Authorization
If not authorized, you'll get:  
```
Error: TEE signer not available  
→ Solution: Follow authorization steps above (Fix #1)
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fromChain` | string | Yes | Source chain: `"ethereum"` or `"base"` |
| `token` | string | Yes | Token symbol: `"USDC"` |
| `amount` | string | Yes | Amount in USDC (e.g., `"100"` for 100 USDC) |
| `toWallet` | address | Yes | Destination address on X Layer |

## Usage

### JavaScript API
```typescript
import { bridgeIn } from '@onchainos/xlayer-bridge-skills';

const result = await bridgeIn(
  'base',           // fromChain
  'USDC',           // token
  '100',            // amount
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'  // toWallet
);

// Result:
// {
//   success: true,
//   data: {
//     txHash: "0x...",
//     orderId: "owlto_...",
//     fromChain: "base",
//     toChain: "xlayer",
//     token: "USDC",
//     amount: "100"
//   },
//   meta: {
//     chainId: 8453,
//     executionTimeMs: 4500
//   }
// }
```

### CLI
```bash
xlbridge in \
  --from-chain base \
  --token USDC \
  --amount 100 \
  --to-wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

### Agent Mode (JSON only)
```bash
AGENT_MODE=true xlbridge in \
  --from-chain base \
  --token USDC \
  --amount 100 \
  --to-wallet 0x...
```

## Execution Flow

1. **Validate Input** - Check chain, token, amount, address format
2. **Get TEE Signer** - Use injected `__TEE_SIGNER__`
3. **Validate Chain** - Ensure signer connected to correct network
4. **Get Pair Info** - Resolve token addresses from Owlto
5. **Check Balance** - Verify sufficient USDC
6. **Build Tx** - Get bridge transaction from Owlto
7. **Slippage Check** - Verify output amount within 0.5%
8. **Approve** - Handle ERC-20 approval if needed (with timeout)
9. **Gas Check** - Estimate gas and verify balance
10. **Execute** - Send bridge transaction
11. **Return** - txHash and orderId

## Error Handling

| Code | Meaning | Resolution |
|------|---------|------------|
| E001 | Unsupported chain | Use ethereum, base, or xlayer |
| E002 | Invalid amount | Use positive decimal number |
| E003 | Insufficient balance | Acquire more USDC |
| E005 | Insufficient gas | Acquire more ETH |
| E006 | Slippage exceeded | Retry or adjust slippage tolerance |
| E007 | Wrong network | Switch signer to correct chain |
| E008 | Approval failed | Check token contract |
| E015 | TEE error | Ensure TEE environment |
| E901 | TEE signer not found | Verify TEE signer injection |

## Safety Features

- TEE-native: No private key exposure
- Slippage protection: 0.5% max (configurable)
- Gas buffer: 20% buffer on estimates
- Approval timeout: 60 second max wait
- Retry logic: 3 retries with exponential backoff
- Balance checks: Pre-flight validation

## Post-Execution

After bridging:
1. Use `xlayer-bridge-status` to track progress
2. Typical completion: 30-90 seconds
3. Verify balance on X Layer before use

## Example Agent Flow

```typescript
// Check if bridge needed
if (xlayerBalance < 50) {
  const bridge = await executeSkill('xlayer-bridge-in', {
    fromChain: 'base',
    token: 'USDC',
    amount: '100',
    toWallet: agentWallet
  });
  
  // Poll for completion
  await pollStatus(bridge.data.txHash);
}
```
