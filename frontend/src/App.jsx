import { useState, useEffect } from 'react'

function App() {
  const [bounties, setBounties] = useState([])
  const [walletMap, setWalletMap] = useState({})
  const [txHashMap, setTxHashMap] = useState({})
  const [statusMap, setStatusMap] = useState({})
  
  // Use relative path for production (served from same origin)
  // Use VITE_API_URL or localhost for development
  const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api')

  useEffect(() => {
    fetch(`${API_URL}/bounties`)
      .then(res => res.json())
      .then(data => {
        if(data.success) {
          setBounties(data.bounties)
        }
      })
      .catch(err => console.error("Failed to fetch bounties: ", err))
  }, [])

  const handleInputChange = (id, value) => {
    setWalletMap(prev => ({ ...prev, [id]: value }))
  }

  const handleTxHashChange = (id, value) => {
    setTxHashMap(prev => ({ ...prev, [id]: value }))
  }

  const submitBounty = async (bountyId) => {
    const address = walletMap[bountyId]
    const txHash = txHashMap[bountyId]
    if (!address || !txHash) return
    
    setStatusMap(prev => ({ ...prev, [bountyId]: { type: 'loading', msg: 'AI Agent is verifying your on-chain data...' } }))

    try {
      const response = await fetch(`${API_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, txHash, bountyId })
      })

      const result = await response.json()
      
      if (result.success && result.verdict === 'PASS') {
        setStatusMap(prev => ({ 
          ...prev, 
          [bountyId]: { 
            type: 'success', 
            msg: result.reason,
            txHash: result.submission.payoutTx
          } 
        }))
      } else {
        setStatusMap(prev => ({ 
          ...prev, 
          [bountyId]: { type: 'error', msg: result.message || result.reason } 
        }))
      }
    } catch (err) {
      setStatusMap(prev => ({ 
        ...prev, 
        [bountyId]: { type: 'error', msg: 'Network error communicating with the agent.' } 
      }))
    }
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">XBounty</div>
        <div style={{ color: 'var(--text-muted)' }}>Powered by X Layer & AI</div>
      </header>

      <main>
        <div className="hero">
          <h1>Smart Bounties.<br/>Verified autonomously.</h1>
          <p>Complete on-chain tasks, submit your wallet, and let our AI agent instantly verify and autonomously send your payout.</p>
        </div>

        <div className="bounty-grid">
          {bounties.map((bounty) => (
            <div className="bounty-card" key={bounty.id}>
              <div className="bounty-header">
                <span className="bounty-id">#{bounty.id.split('_')[1]}</span>
                <span className="bounty-reward">{bounty.reward} USDT</span>
              </div>
              
              <h3 className="bounty-task">{bounty.task}</h3>
              
              <div className="bounty-meta">
                <div className="meta-item">
                  <span title="Volume Req">💰</span> &ge; ${bounty.minVolume}
                </div>
                <div className="meta-item">
                  <span title="Slots">👥</span> {bounty.slots - bounty.claimed.length} / {bounty.slots} slots
                </div>
              </div>

              <div className="submission-form">
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="0xYourWalletAddress..." 
                  value={walletMap[bounty.id] || ''}
                  onChange={(e) => handleInputChange(bounty.id, e.target.value)}
                />
                <input 
                  type="text" 
                  className="input-field"
                  style={{ marginTop: '0.5rem' }}
                  placeholder="0xYourSwapTxHash..." 
                  value={txHashMap[bounty.id] || ''}
                  onChange={(e) => handleTxHashChange(bounty.id, e.target.value)}
                />
                
                <button 
                  className="submit-btn" 
                  onClick={() => submitBounty(bounty.id)}
                  disabled={statusMap[bounty.id]?.type === 'loading' || !walletMap[bounty.id] || !txHashMap[bounty.id]}
                >
                  {statusMap[bounty.id]?.type === 'loading' ? <span className="loading-spinner"></span> : 'Submit & Verify'}
                </button>

                {statusMap[bounty.id] && statusMap[bounty.id].type !== 'loading' && (
                  <div className={`alert ${statusMap[bounty.id].type}`}>
                    <span>{statusMap[bounty.id].msg}</span>
                    {statusMap[bounty.id].txHash && statusMap[bounty.id].txHash !== 'PAYOUT_FAILED' && (
                      <a 
                        className="alert-link" 
                        href={`https://www.oklink.com/xlayer/tx/${statusMap[bounty.id].txHash}`} 
                        target="_blank" 
                        rel="noreferrer"
                      >
                        View Payout →
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {bounties.length === 0 && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', gridColumn: '1 / -1', padding: '3rem' }}>
              No active bounties available at the moment.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
