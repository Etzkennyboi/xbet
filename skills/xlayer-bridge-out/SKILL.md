# Skill: xlayer-bridge-out

**Category**: DeFi / Cross-Chain  
**Chains**: X Layer (196) → Ethereum (1), Base (8453)  
**Tokens**: USDC  
**Complexity**: Medium  
**Risk Level**: Medium

## Description

Bridge USDC from X Layer to Ethereum or Base using Owlto Finance. Gas paid in OKB on X Layer.

## When to Use

- Withdraw profits from X Layer
- Move funds to Ethereum/Base for other operations
- Exit X Layer positions
- Rebalance to other chains

## Prerequisites

### Technical Requirements
- TEE environment with `__TEE_SIGNER__` injected  
  *If not available, see Fix #2: OKX OS Integration Helper*
- Sufficient USDC balance on X Layer
- Sufficient OKB for gas (X Layer native token)

### Required Permissions  
This skill requires Antigravity TEE permissions. To authorize:

1. Go to **Antigravity IDE** in your OKX wallet
2. Navigate to **Skills → xlayer-bridge-out**
3. Click **Settings** → **Request Permissions**
4. Approve these permissions:
   - ✓ TEE Signer Access (required)
   - ✓ Chain RPC Access (X Layer, Ethereum, Base)
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
| `toChain` | string | Yes | Target chain: `"ethereum"` or `"base"` |
| `token` | string | Yes | Token symbol: `"USDC"` |
| `amount` | string | Yes | Amount in USDC |
| `toWallet` | address | Yes | Destination address |

## Usage

### JavaScript API
```typescript
import { bridgeOut } from '@onchainos/xlayer-bridge-skills';

const result = await bridgeOut(
  'base',           // toChain
  'USDC',           // token
  '50',             // amount
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'  // toWallet
);
```

### CLI
```bash
xlbridge out \
  --to-chain base \
  --token USDC \
  --amount 50 \
  --to-wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

### Agent Mode (JSON only)
```bash
AGENT_MODE=true xlbridge out \
  --to-chain base \
  --token USDC \
  --amount 50 \
  --to-wallet 0x...
```

## Execution Flow

Same 11-step flow as bridge-in:
1. Validate input (to-chain instead of from-chain)
2. Get TEE signer
3. Validate on X Layer (not source chain)
4. Get Owlto pair info
5. Check USDC balance on X Layer
6. Build bridge transaction
7. Slippage check
8. Approval (if needed)
9. Gas estimation
10. Execute transaction
11. Return txHash

## Notes

- Gas is paid in OKB (X Layer's native token), not ETH
- Ensure OKB balance for gas (typically 0.01 OKB sufficient)
- Same slippage protection and safety features as bridge-in

## Error Codes

Same as xlayer-bridge-in, plus:
- `E005` on X Layer means insufficient OKB (not ETH)

## Post-Execution

1. Use status check to monitor completion
2. Verify balance on target chain
3. Typical completion: 30-90 seconds

## Example Agent Flow

```typescript
// Withdraw profits from X Layer
const profits = await getXLayerBalance();
if (profits > 100) {
  const result = await executeSkill('xlayer-bridge-out', {
    toChain: 'base',
    token: 'USDC',
    amount: profits.toString(),
    toWallet: agentWallet
  });
  
  logger.info('Withdrawn from X Layer', result.data.txHash);
}
```
