// In-memory Database for XBounty V2 MVP

const db = {
  bounties: [
    {
      id: 'bounty_001',
      title: 'Hold $1 X Layer Assets',
      description: 'Hold at least $1 worth of assets on X Layer mainnet.',
      category: 'Portfolio',
      difficulty: 'Easy',
      task: 'Hold at least $1 worth of assets on X Layer',
      minBalance: 1,
      reward: 0.01,
      slots: 100,
      claimedCount: 0,
      startTime: Date.now(),
      deadline: Date.now() + (30 * 24 * 60 * 60 * 1000),
      active: true,
      featured: true
    },
    {
      id: 'bounty_002',
      title: 'Hold $5 X Layer Assets',
      description: 'Hold at least $5 worth of assets on X Layer mainnet.',
      category: 'Portfolio',
      difficulty: 'Medium',
      task: 'Hold at least $5 worth of assets on X Layer',
      minBalance: 5,
      reward: 0.05,
      slots: 50,
      claimedCount: 0,
      startTime: Date.now(),
      deadline: Date.now() + (30 * 24 * 60 * 60 * 1000),
      active: true,
      featured: true
    },
    {
      id: 'bounty_003',
      title: 'Hold $10 X Layer Assets',
      description: 'Hold at least $10 worth of assets on X Layer mainnet.',
      category: 'Portfolio',
      difficulty: 'Hard',
      task: 'Hold at least $10 worth of assets on X Layer',
      minBalance: 10,
      reward: 10.00,
      slots: 10,
      claimedCount: 0,
      startTime: Date.now(),
      deadline: Date.now() + (30 * 24 * 60 * 60 * 1000),
      active: true,
      featured: true
    },
    {
      id: 'bounty_004',
      title: 'Loyal Holder: $1 (1 Week)',
      description: 'Maintain a $1 balance on X Layer for at least 7 consecutive days.',
      category: 'Loyalty',
      difficulty: 'Easy',
      task: 'Hold $1 for 7 days',
      minBalance: 1,
      reward: 0.01,
      slots: 100,
      claimedCount: 0,
      startTime: Date.now(),
      deadline: Date.now() + (30 * 24 * 60 * 60 * 1000),
      active: true,
      holdPeriod: '1 week'
    },
    {
      id: 'bounty_005',
      title: 'Loyal Holder: $5 (1 Week)',
      description: 'Maintain a $5 balance on X Layer for at least 7 consecutive days.',
      category: 'Loyalty',
      difficulty: 'Medium',
      task: 'Hold $5 for 7 days',
      minBalance: 5,
      reward: 0.05,
      slots: 50,
      claimedCount: 0,
      startTime: Date.now(),
      deadline: Date.now() + (30 * 24 * 60 * 60 * 1000),
      active: true,
      holdPeriod: '1 week'
    },
    {
      id: 'bounty_006',
      title: 'Loyal Holder: $10 (1 Week)',
      description: 'Maintain a $10 balance on X Layer for at least 7 consecutive days.',
      category: 'Loyalty',
      difficulty: 'Hard',
      task: 'Hold $10 for 7 days',
      minBalance: 10,
      reward: 10.00,
      slots: 10,
      claimedCount: 0,
      startTime: Date.now(),
      deadline: Date.now() + (30 * 24 * 60 * 60 * 1000),
      active: true,
      holdPeriod: '1 week'
    }
  ],
  
  submissions: [],
  leaderboard: [],
  
  getBounties() { return this.bounties },
  getBountyById(id) { return this.bounties.find(b => b.id === id) },
  getSubmissionByWallet(walletAddress, bountyId) {
    return this.submissions.find(s => 
      s.walletAddress.toLowerCase() === walletAddress.toLowerCase() && 
      s.bountyId === bountyId
    )
  },
  getSubmissions() { return this.submissions },
  addSubmission(sub) { this.submissions.push(sub) },
  updateBountyClaim(id) {
    const bounty = this.getBountyById(id)
    if (bounty) bounty.claimedCount += 1
  },
  updateLeaderboard(walletAddress, earnedAmount) {
    const entry = this.leaderboard.find(l => l.walletAddress.toLowerCase() === walletAddress.toLowerCase())
    if (entry) {
      entry.totalBounties += 1
      entry.totalEarned += earnedAmount
    } else {
      this.leaderboard.push({
        walletAddress,
        totalBounties: 1,
        totalEarned: earnedAmount,
        firstSeen: Date.now()
      })
    }
    this.leaderboard.sort((a, b) => b.totalEarned - a.totalEarned)
    this.leaderboard.forEach((l, index) => { l.rank = index + 1 })
  },
  getLeaderboard() { return this.leaderboard }
}

module.exports = db
