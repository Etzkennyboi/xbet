const CONFIG = {
  CHAIN_ID: 196, // X Layer
  USDT_ADDRESS: '0xA5a08660F2A9fE38e5047B53F6f6D87F26E9b03F',  // USDT on X Layer
  USDT_DECIMALS: 6,
  EXPLORER: 'https://www.okx.com/explorer/xlayer'
};

const USDT_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

let provider = null;
let signer = null;
let usdtContract = null;
let currentAccount = null;
let agentWallet = "Loading...";
let activeMarkets = [];
let selectedMarketId = null;
let selectedPosition = null;
let countdownTimer = null;
let localHistory = [];
let currentCategoryFilter = 'ALL';

const els = {
  connectBtn: document.getElementById('connect-wallet-btn'),
  marketsContainer: document.getElementById('markets-container'),
  betsTbody: document.getElementById('bets-tbody'),
  lastResolved: document.getElementById('last-resolved-content'),
  walletText: document.getElementById('connected-wallet-text'),
  totalMarkets: document.getElementById('total-markets'),
  totalVolume: document.getElementById('total-volume'),

  // Modal
  modal: document.getElementById('bet-modal'),
  mQuestion: document.getElementById('modal-question'),
  mPosition: document.getElementById('modal-position'),
  mAmount: document.getElementById('bet-amount'),
  mWallet: document.getElementById('modal-wallet-address'),
  mConfirmBtn: document.getElementById('confirm-bet-btn'),
  mStatus: document.getElementById('modal-tx-status'),
  mImage: document.getElementById('modal-image'),
  mDescription: document.getElementById('modal-description'),
  mTimeRemaining: document.getElementById('modal-time-remaining')
};

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for ethers
  let retryCount = 0;
  while (typeof ethers === 'undefined' && retryCount < 50) {
    await new Promise(r => setTimeout(r, 100));
    retryCount++;
  }
  if (typeof ethers === 'undefined') return;

  setupWebSocket();
  fetchInitialData();

  if (window.ethereum) {
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', () => window.location.reload());
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) handleAccountsChanged(accounts);
  }

  setupFilters();
});

function setupFilters() {
  const categoryBtns = document.querySelectorAll('#category-filters .filter-btn');

  categoryBtns.forEach(btn => {
    btn.onclick = () => {
      categoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategoryFilter = btn.dataset.category;
      renderMarkets(activeMarkets);
    };
  });
}

function setupWebSocket() {
  const wsUrl = window.location.protocol === 'https:' ? `wss://${window.location.host}` : `ws://${window.location.host}`;
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_MARKET') fetchMarket();
      if (data.type === 'MARKET_RESOLVED') {
        fetchMarket();
        fetchHistory();
        fetchBets();
      }
      if (data.type === 'MARKET_UPDATED' || data.type === 'MARKET_RESOLVING' || data.type === 'NEW_BET') {
        fetchMarket();
        if (data.type === 'NEW_BET') fetchBets();
      }
      fetchAgentWallet();
    } catch (e) { }
  };
  ws.onclose = () => setTimeout(setupWebSocket, 3000);
}

async function fetchInitialData() {
  await fetchAgentWallet();
  await fetchMarket();
  await fetchHistory();
  updateStats();
}

async function fetchAgentWallet() {
  try {
    const r = await fetch('/api/agent-wallet');
    const data = await r.json();
    agentWallet = data.address;
  } catch (e) { }
}

async function fetchMarket() {
  try {
    const r = await fetch('/api/market');
    activeMarkets = await r.json();
    renderMarkets(activeMarkets);
    updateStats();
  } catch (e) { }
}

async function fetchBets() {
  if (!currentAccount) return;
  try {
    const r = await fetch('/api/bets');
    const bets = await r.json();
    const myBets = bets.filter(b => b.wallet.toLowerCase() === currentAccount.toLowerCase());
    renderBets(myBets);
  } catch (e) { }
}

async function fetchHistory() {
  try {
    const r = await fetch('/api/history');
    localHistory = await r.json();
    renderHistory(localHistory);
    fetchBets();
  } catch (e) { }
}

function updateStats() {
  const totalActive = activeMarkets.filter(m => m.status === 'open').length;
  const totalVol = activeMarkets.reduce((acc, m) => acc + (m.yesPool || 0) + (m.noPool || 0), 0);
  
  if (els.totalMarkets) els.totalMarkets.textContent = totalActive;
  if (els.totalVolume) els.totalVolume.textContent = `$${totalVol.toFixed(2)}`;
}

async function connectWallet() {
  if (!window.ethereum) return alert('Please install MetaMask');
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    await switchToXLayer();
    handleAccountsChanged(accounts);
  } catch (err) {}
}

async function switchToXLayer() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${CONFIG.CHAIN_ID.toString(16)}` }]
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${CONFIG.CHAIN_ID.toString(16)}`,
          chainName: 'X Layer',
          rpcUrls: ['https://rpc.xlayer.tech'],
          nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
          blockExplorerUrls: [CONFIG.EXPLORER]
        }]
      });
    }
  }
}

async function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    currentAccount = null;
    els.connectBtn.textContent = 'CONNECT WALLET';
    renderBets([]);
    return;
  }
  currentAccount = accounts[0];
  const short = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
  els.connectBtn.textContent = `Connected: ${short}`;
  els.connectBtn.classList.add('connected');
  els.walletText.textContent = `(${short})`;

  provider = new ethers.providers.Web3Provider(window.ethereum);
  signer = provider.getSigner();
  usdtContract = new ethers.Contract(CONFIG.USDT_ADDRESS, USDT_ABI, signer);

  fetchBets();
  fetchMarket();
}

function formatTimeRemaining(expiresAt) {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function renderMarkets(markets) {
  if (countdownTimer) clearInterval(countdownTimer);
  if (!markets || markets.length === 0) {
    els.marketsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div>No active markets currently</div>
        <div style="font-size: 0.9em; opacity: 0.7; margin-top: 8px;">Check back soon for new Polymarket-style predictions!</div>
      </div>
    `;
    return;
  }

  const isConnected = !!currentAccount;

  // Filter by category
  let filtered = [...markets].filter(m => m.status === 'open');
  if (currentCategoryFilter !== 'ALL') {
    filtered = filtered.filter(m => m.category?.toLowerCase() === currentCategoryFilter.toLowerCase());
  }

  // Sort by expiresAt (soonest first)
  const sortedMarkets = filtered.sort((a, b) => a.expiresAt - b.expiresAt);

  if (sortedMarkets.length === 0) {
    els.marketsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div>No markets match this filter</div>
      </div>
    `;
    return;
  }

  els.marketsContainer.innerHTML = sortedMarkets.map(m => {
    const totalPool = (m.yesPool || 0) + (m.noPool || 0);
    const yesPercent = totalPool > 0 ? ((m.yesPool || 0) / totalPool * 100).toFixed(1) : 50;
    const noPercent = totalPool > 0 ? ((m.noPool || 0) / totalPool * 100).toFixed(1) : 50;
    const timeLeft = formatTimeRemaining(m.expiresAt);
    const imageHtml = m.image ? `<img src="${m.image}" alt="" class="market-image" onerror="this.style.display='none'">` : '';
    
    return `
    <div class="market-card" id="card-${m.id}" data-category="${m.category || 'General'}">
      ${imageHtml}
      <div class="market-header">
        <span class="market-category">${m.category || 'General'}</span>
        <span class="market-source">via Polymarket</span>
      </div>
      <div class="market-title">${m.question}</div>
      ${m.description ? `<div class="market-description">${m.description.substring(0, 120)}${m.description.length > 120 ? '...' : ''}</div>` : ''}
      <div class="pool-bar">
        <div class="pool-yes" style="width: ${yesPercent}%"></div>
        <div class="pool-no" style="width: ${noPercent}%"></div>
      </div>
      <div class="pool-labels">
        <span>YES ${yesPercent}%</span>
        <span>NO ${noPercent}%</span>
      </div>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stats-label">Total Pool</span>
          <span class="stats-val">$${totalPool.toFixed(2)}</span>
        </div>
        <div class="stat-item">
          <span class="stats-label">Ends in</span>
          <span class="stats-val time-left" id="time-${m.id}">${timeLeft}</span>
        </div>
      </div>
      <div class="action-buttons">
        <button class="btn-yes" ${!isConnected ? 'disabled' : ''} onclick="openBetModal('${m.id}', 'YES')">
          <span>YES</span>
          <span style="font-size: 0.85em; opacity: 0.8;">Bet</span>
        </button>
        <button class="btn-no" ${!isConnected ? 'disabled' : ''} onclick="openBetModal('${m.id}', 'NO')">
          <span>NO</span>
          <span style="font-size: 0.85em; opacity: 0.8;">Bet</span>
        </button>
      </div>
    </div>
  `}).join('');

  // Start countdown timer
  countdownTimer = setInterval(() => {
    sortedMarkets.forEach(m => {
      const el = document.getElementById(`time-${m.id}`);
      if (el) {
        el.textContent = formatTimeRemaining(m.expiresAt);
      }
    });
  }, 60000);
}

function renderBets(bets) {
  if (bets.length === 0) {
    els.betsTbody.innerHTML = `<tr><td colspan="5" class="empty-state">No bets placed yet. Connect your wallet to start betting!</td></tr>`;
    return;
  }
  bets.sort((a, b) => b.timestamp - a.timestamp);
  els.betsTbody.innerHTML = bets.map(b => {
    const resolved = localHistory.find(h => h.id === b.marketId);
    const market = activeMarkets.find(m => m.id === b.marketId);
    const marketQuestion = market ? market.question.substring(0, 40) + (market.question.length > 40 ? '...' : '') : 'Unknown Market';
    
    let statusHtml = '<span class="status-pending">⏳ PENDING</span>';
    let rowClass = "";
    let payoutHtml = '';
    
    if (resolved) {
      const won = resolved.result === b.position;
      statusHtml = won ? `<span class="status-won">💰 WON</span>` : `<span class="status-lost">❌ LOST</span>`;
      rowClass = won ? "row-won" : "row-lost";
      if (won && b.payout) {
        payoutHtml = `<span style="color: var(--success-color)">+$${b.payout.toFixed(2)}</span>`;
      }
    }
    
    return `
      <tr class="${rowClass}">
        <td>${marketQuestion}</td>
        <td style="color: var(--${b.position.toLowerCase()}-color); font-weight: bold;">${b.position}</td>
        <td>$${b.stake.toFixed(2)}</td>
        <td>${statusHtml}</td>
        <td>${payoutHtml}</td>
      </tr>
    `;
  }).join('');
}

function renderHistory(history) {
  if (history.length === 0) {
    els.lastResolved.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📜</div>
        <div>No markets resolved yet</div>
      </div>
    `;
    return;
  }
  
  const last = history[history.length - 1];
  const winnersCount = last.payouts ? last.payouts.length : 0;
  const aiConfidence = last.aiResolution ? (last.aiResolution.confidence * 100).toFixed(1) : 'N/A';
  
  els.lastResolved.innerHTML = `
    <div class="history-card">
      <div class="history-question">${last.question}</div>
      <div class="history-result">
        <span class="result-badge ${last.result.toLowerCase()}">${last.result}</span>
        <span class="confidence">AI Confidence: ${aiConfidence}%</span>
      </div>
      <div class="history-details">
        <span>${winnersCount} winners paid</span>
        <span>Pool: $${((last.yesPool || 0) + (last.noPool || 0)).toFixed(2)}</span>
      </div>
      ${last.aiResolution?.reasoning ? `<div class="ai-reasoning">"${last.aiResolution.reasoning.substring(0, 100)}..."</div>` : ''}
    </div>
  `;
}

function openBetModal(marketId, position) {
  selectedMarketId = marketId;
  selectedPosition = position;
  const market = activeMarkets.find(m => m.id === marketId);
  if (!market) return;

  els.mQuestion.textContent = market.question;
  els.mPosition.textContent = position;
  els.mPosition.style.color = `var(--${position.toLowerCase()}-color)`;
  els.mWallet.textContent = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
  els.mAmount.value = "1.00";
  els.mAmount.min = "0.50";
  els.mAmount.max = "50.00";
  els.mStatus.textContent = '';
  els.mConfirmBtn.disabled = false;
  els.mConfirmBtn.textContent = 'CONFIRM BET';
  
  // Show additional info
  if (els.mDescription) els.mDescription.textContent = market.description || '';
  if (els.mTimeRemaining) els.mTimeRemaining.textContent = `Expires: ${formatTimeRemaining(market.expiresAt)}`;
  if (els.mImage && market.image) {
    els.mImage.src = market.image;
    els.mImage.style.display = 'block';
  } else if (els.mImage) {
    els.mImage.style.display = 'none';
  }
  
  els.modal.classList.add('open');
}

function closeModal() { 
  els.modal.classList.remove('open'); 
  selectedMarketId = null;
  selectedPosition = null;
}

async function confirmBet() {
  if (!usdtContract || !agentWallet) return;
  const amount = parseFloat(els.mAmount.value);
  if (isNaN(amount) || amount < 0.50) {
    els.mStatus.textContent = 'Minimum bet is 0.50 USDT';
    return;
  }
  if (amount > 50.00) {
    els.mStatus.textContent = 'Maximum bet is 50.00 USDT';
    return;
  }

  els.mConfirmBtn.disabled = true;
  els.mConfirmBtn.textContent = 'APPROVING...';
  els.mStatus.textContent = 'Please approve the transaction in your wallet...';

  try {
    const amountWei = ethers.utils.parseUnits(amount.toFixed(CONFIG.USDT_DECIMALS), CONFIG.USDT_DECIMALS);
    
    // Check allowance first
    const allowance = await usdtContract.allowance(currentAccount, agentWallet);
    if (allowance.lt(amountWei)) {
      // Need to approve
      const approveTx = await usdtContract.approve(agentWallet, ethers.constants.MaxUint256);
      els.mStatus.textContent = 'Approving USDT spend...';
      await approveTx.wait();
    }
    
    els.mConfirmBtn.textContent = 'TRANSFERRING...';
    els.mStatus.textContent = 'Transferring USDT...';
    
    // Transfer USDT to agent
    const tx = await usdtContract.transfer(agentWallet, amountWei);
    els.mStatus.textContent = 'Waiting for confirmation...';
    await tx.wait();

    // Register bet with backend
    const r = await fetch('/api/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: currentAccount,
        position: selectedPosition,
        amount: amount,
        txHash: tx.hash,
        marketId: selectedMarketId
      })
    });
    
    if (!r.ok) throw new Error('Failed to register bet');
    
    els.mStatus.innerHTML = '✅ <span style="color: var(--success-color)">Bet placed successfully!</span>';
    fetchBets();
    fetchMarket();
    setTimeout(closeModal, 2000);
  } catch (err) {
    console.error('Bet error:', err);
    els.mConfirmBtn.disabled = false;
    els.mConfirmBtn.textContent = 'CONFIRM BET';
    els.mStatus.innerHTML = `❌ <span style="color: var(--danger-color)">${err.message}</span>`;
  }
}
