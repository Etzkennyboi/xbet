# SGX Attestation & Trust Model

## What Is Attestation?

When the bridge needs to sign transactions, it runs inside a hardware-based **Trusted Execution Environment (TEE)** — specifically Intel SGX (Software Guard Extensions).

SGX **attestation** is the process of cryptographically verifying that:
1. The code running in the enclave is exactly what you expect (no tampering)
2. The enclave is running on genuine Intel SGX hardware (not simulated)
3. The enclave's state is trustworthy for signing operations

If attestation fails, the bridge **will not signing your transaction**.

## How Bridge Uses Attestation

### Step 1: User Initiates Bridge

```
User calls: onchainos bridge execute --direction in --amount "100" ...
```

### Step 2: Bridge Step 2 — Verify Attestation (Automatic)

```
Bridge immediately verifies:

  1. Check MRENCLAVE (Measurement of code)
     • Expected: SHA-256(onchainos-skills binary)
     • Actual: Read from SGX attestation report
     • If mismatch: ATTESTATION_FAILED (2002) error

  2. Check MRSIGNER (Signer identity)
     • Expected: SHA-256(OKX signing key)
     • Actual: Read from SGX attestation report
     • If mismatch: ATTESTATION_FAILED (2002) error

  3. Verify attestation signature
     • Check: Signature matches Intel Attestation Service
     • If invalid: ATTESTATION_FAILED (2002) error
```

If all checks pass → Continue with bridge execution  
If any check fails → **Abort immediately, no transaction signed**

## Error: ATTESTATION_FAILED (2002)

### Symptoms

```
Error: ATTESTATION_FAILED
Code: 2002
Message: SGX enclave attestation failed or MRENCLAVE mismatch
```

### Causes & Fixes

| Cause | Fix |
|-------|-----|
| Old `onchainos` version | Update: `curl -sSL https://...install.sh \| sh` |
| Corrupted binary | Reinstall completely: `rm ~/.onchainos && install.sh` |
| SGX driver outdated | Update SGX drivers from Intel website |
| SGX disabled in BIOS | Go to BIOS settings, enable SGX, restart computer |
| Running in VM/simulator | Run on real SGX hardware or use non-SGX mode (not recommended) |
| Enclave tampering detected | Possible malware — scan system |

### Recovery Steps

1. **Verify version**:
   ```bash
   onchainos --version
   # Should show: v3.0.0 or higher
   ```

2. **Reinstall if needed**:
   ```bash
   # Remove old installation
   rm -rf ~/.onchainos ~/.config/onchainos
   
   # Reinstall
   curl -sSL https://raw.githubusercontent.com/okx/onchainos-skills/main/install.sh | sh
   
   # Verify
   onchainos --version
   ```

3. **Check SGX hardware support**:
   ```bash
   # Linux
   grep -o 'sgx' /proc/cpuinfo | sort | uniq
   # Should output: sgx
   
   # Windows (PowerShell)
   Get-WmiObject Win32_Processor | Select-Object Name
   # Look for "SGX" in processor features
   ```

4. **Verify SGX is enabled in BIOS**:
   - Restart computer, enter BIOS (usually F2 or DEL during boot)
   - Look for "Intel SGX" or "Software Guard Extensions"
   - Enable if disabled
   - Save and restart

5. **Check SGX driver**:
   ```bash
   # Linux
   ls -la /dev/isgx
   # Should exist if driver installed
   
   # Windows
   # Download from: https://github.com/intel/linux-sgx-driver
   ```

6. **Restart TEE session**:
   ```bash
   onchainos wallet restart
   onchainos bridge execute ...  # Retry
   ```

If still failing after all steps, **contact support** with:
- Output of `onchainos --version`
- Output of `onchainos wallet status`
- `MRENCLAVE` value from error message (if shown)
- Your CPU model (output of `uname -m` or Windows System Info)

## MRENCLAVE: Code Measurement

### What It Is

`MRENCLAVE` is a 256-bit SHA-256 hash of:
- The exact bytecode of the enclave binary
- All runtime configuration
- All linked libraries

### Why It Matters

If someone tries to:
- Modify the bridge code
- Inject malicious code
- Run from a tampered binary
- Swap with old/insecure version

...the MRENCLAVE will **change**, and attestation will **fail**.

### Expected Value for v3.0.0

```
MRENCLAVE: 0x7c3a8f9e4d2b1c6f7a8e9d0c1b2a3f4e  (example, see actual in details)
```

To verify:
```bash
# After install
onchainos wallet status | grep mrenclave
```

## MRSIGNER: Authority Identity

### What It Is

`MRSIGNER` is a 256-bit SHA-256 hash of the **signing key** that created the enclave.

### Why It Matters

Proves the enclave was built and signed by a trusted authority (OKX/Antigravity IDE), not an attacker.

### For This Bridge

```
Expected MRSIGNER: OKX Attestation Key (SHA-256)
Verified by: Intel Attestation Service (IAS)
```

If someone forked the code or recompiled it, they'd have a different MRSIGNER, and attestation would fail.

## Trust Chain

```
┌─ Your Computer ─────────────────────────────────────────────┐
│                                                              │
│  You run: onchainos bridge execute --amount "100" ...       │
│             │                                                │
│             └─ Starts SGX enclave (trusted hardware)        │
│                │                                             │
│                └─ Enclave generates attestation report       │
│                   • Contains: MRENCLAVE, MRSIGNER            │
│                   │                                          │
│                   └─ Bridge verifies locally:                │
│                      ✓ MRENCLAVE matches v3.0.0             │
│                      ✓ MRSIGNER from OKX key                │
│                      │                                       │
│                      └─> Attestation PASSED ✓               │
│                          Proceed with bridge                 │
│ OR                                                           │
├─ If Attestation FAILS ──────────────────────────────────────┤
│                                                              │
│                   └─> ABORT immediately                     │
│                       Error: ATTESTATION_FAILED (2002)      │
│                       No transaction signed                  │
│                       No funds moved                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Comparison: With & Without SGX

### Without SGX (Not Recommended)

```
User's private key → Software signer → Exposed to OS/malware
                                       ↓
                              Funds AT RISK
```

### With SGX (Bridge Standard)

```
User's private key → SGX enclave (isolated) → Hardware protection
                     • No access from host OS
                     • No access from malware
                     • Verified by attestation
                                       ↓
                              Funds PROTECTED
```

## FAQ

### Q: Can the attestation be faked?

**A**: No. Attestation is:
- Cryptographically signed by Intel
- Verified against Intel's public certificates
- On real SGX hardware only (no simulation possible)

If someone could fake SGX attestation, they could break all SGX security globally — not just this bridge. It's considered secure by major enterprises (banks, governments).

### Q: Do I need to do anything?

**A**: No. Attestation is **automatic**:
1. Install onchain OS
2. Run bridge
3. Attestation happens in background
4. Bridge proceeds or fails gracefully

### Q: What if I don't trust SGX?

**A**: Two options:
1. **Use custody service**: Use exchange/wallet (trust + convenience, but higher fees)
2. **Audit the code**: Bridge v3.0.0 is open source on GitHub, fully auditable
3. **Test on testnet first**: Bridge small amounts, verify behavior

### Q: How often is attestation checked?

**A**: Every single bridge execution:
- Step 2 of 13: **Attestation check**
- **All signing operations** require attestation to pass
- No cached/skipped attestation

## Additional Resources

- **Intel SGX Documentation**: https://software.intel.com/en-us/sgx
- **Intel Attestation Service (IAS)**: https://software.intel.com/en-us/articles/intel-software-guard-extensions-attestation-service
- **OnchainOS Trust Model**: https://onchainos.docs.okx.com/trust-model
- **Audit Report**: See [SECURITY.md](../../SECURITY.md) for full transparency report
