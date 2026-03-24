const CONFIG = {
  CHAIN_ID: 196, // X Layer
  USDC_ADDRESS: '0x74b7F16337b8972027F6196A17a631aC6dE26d22',
  USDC_DECIMALS: 6,
  EXPLORER: 'https://www.okx.com/explorer/xlayer'
};

const USDC_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
];

let provider = null;
let signer = null;
let usdcContract = null;
let currentAccount = null;
let agentWallet = "Loading...";
let activeMarkets = [];
let livePrices = {};
let selectedMarketId = null;
let selectedPosition = null;
let countdownTimer = null;
let localHistory = [];

const els = {
  connectBtn: document.getElementById('connect-wallet-btn'),
  marketsContainer: document.getElementById('markets-container'),
  betsTbody: document.getElementById('bets-tbody'),
  lastResolved: document.getElementById('last-resolved-content'),
  walletText: document.getElementById('connected-wallet-text'),

  // Modal
  modal: document.getElementById('bet-modal'),
  mQuestion: document.getElementById('modal-question'),
  mPosition: document.getElementById('modal-position'),
  mAmount: document.getElementById('bet-amount'),
  mWallet: document.getElementById('modal-wallet-address'),
  mConfirmBtn: document.getElementById('confirm-bet-btn'),
  mStatus: document.getElementById('modal-tx-status')
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
});

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
      if (data.type === 'MARKET_UPDATED' || data.type === 'MARKET_RESOLVING') {
        fetchMarket();
        if (data.type === 'MARKET_UPDATED') fetchBets();
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
  fetchLivePrices();
  setInterval(fetchLivePrices, 10000);
}

async function fetchLivePrices() {
  const symbols = ['BTC', 'ETH', 'SOL'];
  for (const s of symbols) {
    try {
      const r = await fetch(`/api/price?symbol=${s}`);
      const data = await r.json();
      if (data.price) livePrices[s] = data.price;
    } catch (e) {}
  }
  updatePriceUI();
}

function updatePriceUI() {
  Object.keys(livePrices).forEach(symbol => {
    const el = document.getElementById(`price-${symbol}`);
    if (el) el.textContent = `$${livePrices[symbol].toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  });
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
  usdcContract = new ethers.Contract(CONFIG.USDC_ADDRESS, USDC_ABI, signer);

  fetchBets();
  fetchMarket();
}

function renderMarkets(markets) {
  if (countdownTimer) clearInterval(countdownTimer);
  if (!markets || markets.length === 0) {
    els.marketsContainer.innerHTML = '<div class="loading">No active markets currently.</div>';
    return;
  }

  const isConnected = !!currentAccount;

  els.marketsContainer.innerHTML = markets.map(m => `
    <div class="market-card" id="card-${m.id}">
      <div class="live-price-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; color: #6b7280;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        ${m.symbol}-USDC: <span id="price-${m.symbol}">...</span>
      </div>
      <div class="market-title">${m.question}</div>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stats-label">Starting</span>
          <span class="stats-val">$${m.startPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="stat-item">
          <span class="stats-label">Target</span>
          <span class="stats-val">$${m.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="stat-item" style="text-align: right;">
          <span class="stats-label">Resolves in</span>
          <span class="stats-val time-left" id="time-${m.id}">--:--</span>
        </div>
      </div>
      <div class="action-buttons">
        <button class="btn-yes" ${!isConnected ? 'disabled' : ''} onclick="openBetModal('${m.id}', 'YES')">
          <span>Yes</span>
          <span style="font-weight: 500; opacity: 0.9;">50¢</span>
        </button>
        <button class="btn-no"  ${!isConnected ? 'disabled' : ''} onclick="openBetModal('${m.id}', 'NO')">
          <span>No</span>
          <span style="font-weight: 500; opacity: 0.9;">50¢</span>
        </button>
      </div>
    </div>
  `).join('');


  updatePriceUI();

  countdownTimer = setInterval(() => {
    markets.forEach(m => {
      const diff = m.expiresAt - Date.now();
      const el = document.getElementById(`time-${m.id}`);
      if (!el) return;
      if (diff <= 0) {
        el.textContent = "Resolving...";
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        el.textContent = `${mins}:${secs}`;
      }
    });
  }, 1000);
}

function renderBets(bets) {
  if (bets.length === 0) {
    els.betsTbody.innerHTML = `<tr><td colspan="4" class="empty-state">No bets placed yet</td></tr>`;
    return;
  }
  bets.sort((a, b) => b.timestamp - a.timestamp);
  els.betsTbody.innerHTML = bets.map(b => {
    const resolved = localHistory.find(h => h.id === b.marketId);
    let statusHtml = '<span class="status-pending">⏳ PENDING</span>';
    let rowClass = "";
    if (resolved) {
      const won = resolved.result === b.position;
      statusHtml = won ? `<span class="status-won">💰 WON</span>` : `<span class="status-lost">❌ LOST</span>`;
      rowClass = won ? "row-won" : "row-lost";
    }
    const marketSymbol = b.marketId.split('_')[1] || "BTC";
    return `
      <tr class="${rowClass}">
        <td>${marketSymbol} > Target</td>
        <td style="color: var(--${b.position.toLowerCase()}-color); font-weight: bold;">${b.position}</td>
        <td>$${b.stake.toFixed(2)}</td>
        <td>${statusHtml}</td>
      </tr>
    `;
  }).join('');
}

function renderHistory(history) {
  if (history.length === 0) {
    els.lastResolved.innerHTML = `<div class="empty-state">No markets resolved yet</div>`;
    return;
  }
  const last = history[history.length - 1];
  const winnersCount = last.payouts ? last.payouts.length : 0;
  els.lastResolved.innerHTML = `
    <div class="desc">
      ${last.symbol} closed at <strong>$${last.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> → <span class="${last.result === 'YES' ? 'won' : 'lost'}">${last.result} WON</span>
    </div>
    <div class="details">${winnersCount} winners paid</div>
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
  els.mAmount.value = "0.05";
  els.mStatus.textContent = '';
  els.mConfirmBtn.disabled = false;
  els.mConfirmBtn.textContent = 'CONFIRM BET';
  els.modal.classList.add('open');
}

function closeModal() { els.modal.classList.remove('open'); }

async function confirmBet() {
  if (!usdcContract || !agentWallet) return;
  const amount = parseFloat(els.mAmount.value);
  if (isNaN(amount) || amount < 0.01) return alert("Min 0.01");

  els.mConfirmBtn.disabled = true;
  els.mConfirmBtn.textContent = 'SIGNING...';

  try {
    const amountWei = ethers.utils.parseUnits(amount.toFixed(CONFIG.USDC_DECIMALS), CONFIG.USDC_DECIMALS);
    const tx = await usdcContract.transfer(agentWallet, amountWei);
    els.mStatus.textContent = 'Waiting for confirmation...';
    await tx.wait();

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
    if (!r.ok) throw new Error('Failed to register');
    els.mStatus.textContent = '✅ Success!';
    fetchBets();
    fetchMarket();
    setTimeout(closeModal, 2000);
  } catch (err) {
    els.mConfirmBtn.disabled = false;
    els.mStatus.textContent = err.message;
  }
}
