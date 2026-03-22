const express = require('express')
const router = express.Router()
const { verifyWallet, sendPayout } = require('../agent/verify')

// In-memory bounty store (we upgrade to DB later)
const bounties = [
  {
    id: 'bounty_001',
    task: 'Complete a DEX swap on X Layer mainnet',
    minVolume: 0.01,
    reward: 0.01,
    slots: 5,
    claimed: [],
    startTime: 1774100000000, // Fixed time in the past
    deadline: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
    active: true
  }
]

const submissions = []
const usedTxHashes = [] // Anti-fraud: prevent reuse of the same swap TX

// GET all active bounties
router.get('/bounties', (req, res) => {
  const active = bounties.filter(b => b.active)
  res.json({ success: true, bounties: active })
})

// POST submit wallet for verification
router.post('/submit', async (req, res) => {
  const { walletAddress, txHash, bountyId } = req.body

  // Basic validation
  if (!walletAddress || !txHash || !bountyId) {
    return res.status(400).json({ 
      success: false, 
      message: 'walletAddress, txHash, and bountyId are required' 
    })
  }

  // 1. Check if TX Hash has already been used (SYSTEM-WIDE ANTI-FRAUD)
  if (usedTxHashes.includes(txHash.toLowerCase())) {
    return res.status(400).json({ 
      success: false, 
      message: 'This transaction has already been used to claim a bounty. Fraud detected.' 
    })
  }

  // Find bounty
  const bounty = bounties.find(b => b.id === bountyId)
  if (!bounty || !bounty.active) {
    return res.status(404).json({ 
      success: false, 
      message: 'Bounty not found or inactive' 
    })
  }

  // Check if wallet already claimed
  if (bounty.claimed.includes(walletAddress.toLowerCase())) {
    return res.status(400).json({ 
      success: false, 
      message: 'Wallet already claimed this bounty' 
    })
  }

  // Check slots
  if (bounty.claimed.length >= bounty.slots) {
    return res.status(400).json({ 
      success: false, 
      message: 'All bounty slots have been claimed' 
    })
  }

  try {
    // Run AI verification with TX Hash
    const result = await verifyWallet(walletAddress, txHash, bounty)

    // Record submission
    const submission = {
      id: `sub_${Date.now()}`,
      walletAddress,
      txHash,
      bountyId,
      verdict: result.verdict,
      reason: result.reason,
      timestamp: new Date().toISOString(),
      payoutTx: null
    }

    if (result.verdict === 'PASS') {
      // 2. MARK TX HASH AS USED (PERMANENTLY)
      usedTxHashes.push(txHash.toLowerCase())

      // Mark wallet as claimed
      bounty.claimed.push(walletAddress.toLowerCase())
      
      // Trigger payout
      const payoutTxHash = await sendPayout(walletAddress, bounty.reward)
      submission.payoutTx = payoutTxHash || 'PAYOUT_FAILED'
    }

    submissions.push(submission)

    return res.json({
      success: true,
      verdict: result.verdict,
      reason: result.reason,
      submission
    })

  } catch (error) {
    console.error('Submission error:', error)
    return res.status(500).json({ 
      success: false, 
      message: 'Verification failed, try again' 
    })
  }
})

// GET all submissions (admin)
router.get('/submissions', (req, res) => {
  res.json({ success: true, submissions })
})

module.exports = router
