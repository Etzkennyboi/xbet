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
let activeMarketId = null;
let selectedPosition = null;
let countdownTimer = null;
let localHistory = [];

// DOM Elements
const els = {
  connectBtn: document.getElementById('connect-wallet-btn'),
  marketCard: document.getElementById('market-card'),
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
  console.log("DOM Loaded, initializing...");
  
  // Wait for ethers to be defined (max 5 seconds)
  let retryCount = 0;
  while (typeof ethers === 'undefined' && retryCount < 50) {
    console.log("Waiting for ethers.js...");
    await new Promise(r => setTimeout(r, 100));
    retryCount++;
  }

  if (typeof ethers === 'undefined') {
    alert("Critical: ethers.js library failed to load. Please check your internet connection and refresh.");
    return;
  }

  setupWebSocket();
  fetchInitialData();

  if (window.ethereum) {
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', () => window.location.reload());
    
    // Auto-connect on page load/refresh silently if previously authorized
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        console.log("Wallet connection persisted from previous session");
        handleAccountsChanged(accounts);
      }
    } catch(e) {
      console.warn("Failed to check existing connected accounts:", e);
    }
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
    } catch(e) {}
  };
  
  ws.onclose = () => setTimeout(setupWebSocket, 3000);
}

async function fetchInitialData() {
  await fetchAgentWallet();
  await fetchMarket();
  await fetchHistory();
  fetchLivePrice();
  // Poll price every 10s
  setInterval(fetchLivePrice, 10000);
}

async function fetchLivePrice() {
  try {
    const r = await fetch('/api/price');
    const data = await r.json();
    if (data.price) {
      const el = document.getElementById('current-price-val');
      if (el) {
          el.textContent = `$${data.price.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
          el.classList.add('updated');
          setTimeout(() => el.classList.remove('updated'), 500);
      }
    }
  } catch(e) {}
}

async function fetchAgentWallet() {
  try {
    const r = await fetch('/api/agent-wallet');
    const data = await r.json();
    agentWallet = data.address;
  } catch(e) {}
}

async function fetchMarket() {
  try {
    const r = await fetch('/api/market');
    const m = await r.json();
    renderMarket(m);
  } catch(e) {}
}

async function fetchBets() {
  if (!currentAccount) return;
  try {
    const r = await fetch('/api/bets');
    const bets = await r.json();
    const myBets = bets.filter(b => b.wallet.toLowerCase() === currentAccount.toLowerCase());
    renderBets(myBets);
  } catch(e) {}
}

async function fetchHistory() {
  try {
    const r = await fetch('/api/history');
    localHistory = await r.json();
    renderHistory(localHistory);
    // After history is updated, re-render bets to update their status (won/lost)
    fetchBets();
  } catch(e) {}
}

// User Action: Clicking the "Connect Wallet" button
async function connectWallet() {
  if (!window.ethereum) return alert('Please install MetaMask to play.');
  
  try {
    // 1. Request access to the wallet
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    // 2. Immediately switch to X Layer network
    await switchToXLayer();
    
    // 3. Complete binding
    handleAccountsChanged(accounts);
  } catch (err) {
    console.error("Wallet connection failed:", err);
  }
}

async function switchToXLayer() {
  try {
    // Attempt switch
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${CONFIG.CHAIN_ID.toString(16)}` }]
    });
  } catch(err) {
    // If chain doesn't exist, prompt to add it
    if (err.code === 4902) {
      try {
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
      } catch (addError) {
        console.error('Failed to add X Layer', addError);
        alert('Please manually switch your wallet to the X Layer network.');
      }
    } else {
      console.error('Failed to switch to X Layer', err);
    }
  }
}

async function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    currentAccount = null;
    els.connectBtn.textContent = 'CONNECT WALLET';
    els.connectBtn.classList.remove('connected');
    els.walletText.textContent = '';
    renderBets([]);
    return;
  }

  currentAccount = accounts[0];
  const short = `${currentAccount.slice(0,6)}...${currentAccount.slice(-4)}`;
  els.connectBtn.textContent = `Connected: ${short}`;
  els.connectBtn.classList.add('connected');
  els.walletText.textContent = `(${short})`;

  // Init ethers instance to enable prompt-signing
  provider = new ethers.providers.Web3Provider(window.ethereum);
  signer = provider.getSigner();
  usdcContract = new ethers.Contract(CONFIG.USDC_ADDRESS, USDC_ABI, signer);

  // Check underlying network silently
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (parseInt(chainId, 16) !== CONFIG.CHAIN_ID) {
     console.warn("Wallet connected to incorrect chain. Expecting", CONFIG.CHAIN_ID, "Got", parseInt(chainId, 16));
  }

  fetchBets();
  fetchMarket();
}

function renderMarket(m) {
  if (countdownTimer) clearInterval(countdownTimer);

  if (!m || !m.id || m.status !== 'open') {
    els.marketCard.innerHTML = `
      <div class="loading">
        <span class="spin">◈</span>
        Agent is creating a new market...
      </div>
    `;
    return;
  }

  activeMarketId = m.id;
  const isConnected = !!currentAccount;

  const agentDisplay = `<div class="stats-label">Agent Wallet:</div>
                        <div class="stats-val" id="dynamic-agent-balance">Verifying onchain...</div>`;

  els.marketCard.innerHTML = `
    <div id="live-price-badge" class="live-price-badge">BTC-USDC: <span id="current-price-val">...</span></div>
    <div class="market-title">${m.question}</div>
    <div class="stats-grid">
      <div class="stats-label">Start Price:</div>
      <div class="stats-val">$${m.startPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
      <div class="stats-label">Target Price:</div>
      <div class="stats-val">$${m.targetPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
      <div class="stats-label">Time Left:</div>
      <div class="stats-val time-left" id="time-left-display">--:--</div>
      ${agentDisplay}
    </div>
    
    <div class="progress-container">
      <div id="progress-bar" class="progress-bar"></div>
    </div>

    <div class="market-summary">
      <span>Total Bets: ${m.yesCount + m.noCount}</span>
      <span>Pool: $${(m.yesPool + m.noPool).toFixed(2)} USDC</span>
    </div>

    <div class="action-buttons">
      <button class="btn-yes" ${!isConnected ? 'disabled title="Connect wallet first"' : ''} onclick="openBetModal('YES')">YES ↑</button>
      <button class="btn-no"  ${!isConnected ? 'disabled title="Connect wallet first"' : ''} onclick="openBetModal('NO')">NO ↓</button>
    </div>
  `;

  const updateTimer = () => {
    const diff = m.expiresAt - Date.now();
    const el = document.getElementById('time-left-display');
    const bar = document.getElementById('progress-bar');
    if (!el) return;
    
    // Update Progress Bar
    const total = 5 * 60 * 1000;
    const elapsed = Date.now() - m.startTime;
    const progress = Math.max(0, 100 - (elapsed / total * 100));
    if (bar) bar.style.width = `${progress}%`;

    if (diff <= 0) {
      el.textContent = "Resolving...";
      el.classList.add('pulse');
      if (bar) bar.style.width = '0%';
      clearInterval(countdownTimer);
    } else {
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      el.textContent = `${mins}:${secs}`;
    }
  };
  
  updateTimer();
  countdownTimer = setInterval(updateTimer, 1000);

  fetch('/api/agent-wallet').then(r=>r.json()).then(d => {
    const el = document.getElementById('dynamic-agent-balance');
    if (el) el.textContent = `$${d.balance.toFixed(2)} USDC`;
  }).catch(()=>{});
}

function renderBets(bets) {
  if (bets.length === 0) {
    els.betsTbody.innerHTML = `<tr><td colspan="4" class="empty-state">No bets placed yet</td></tr>`;
    return;
  }

  bets.sort((a,b) => b.timestamp - a.timestamp);

  els.betsTbody.innerHTML = bets.map(b => {
    // Check if the market this bet belongs to has been resolved
    const resolved = localHistory.find(h => h.id === b.marketId);
    
    let statusHtml = '<span class="status-pending">⏳ PENDING</span>';
    let rowClass = "";

    if (resolved) {
      const won = resolved.result === b.position;
      statusHtml = won 
        ? `<span class="status-won">💰 WON (+$${(b.stake * 2).toFixed(2)})</span>` 
        : `<span class="status-lost">❌ LOST (-$${b.stake.toFixed(2)})</span>`;
      rowClass = won ? "row-won" : "row-lost";
    } else if (b.marketId !== activeMarketId) {
      statusHtml = '<span class="status-expired">⌛ EXPIRED</span>';
    }

    return `
      <tr class="${rowClass}">
        <td>BTC > Target</td>
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
  const isYesWin = last.result === 'YES';

  els.lastResolved.innerHTML = `
    <div class="desc">
      BTC closed at <strong>$${last.finalPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong> → <span class="${isYesWin ? 'won' : 'lost'}">${last.result} WON</span>
    </div>
    <div class="details">
      ${winnersCount} winners paid | TX records onchain
    </div>
  `;
}

// --- Modal Logic ---

function openBetModal(position) {
  if (!activeMarketId || !currentAccount) return;
  selectedPosition = position;
  
  els.mQuestion.textContent = document.querySelector('.market-title').textContent;
  els.mPosition.textContent = position;
  els.mPosition.style.color = `var(--${position.toLowerCase()}-color)`;
  els.mWallet.textContent = `${currentAccount.slice(0,6)}...${currentAccount.slice(-4)}`;
  els.mAmount.value = "0.05";
  
  els.mStatus.textContent = '';
  els.mStatus.className = 'tx-status';
  els.mConfirmBtn.disabled = false;
  els.mConfirmBtn.textContent = 'CONFIRM BET';

  els.modal.classList.add('open');
}

function closeModal() {
  els.modal.classList.remove('open');
}

async function confirmBet() {
  console.log("Attempting to confirm bet...");
  console.log("Signer:", signer);
  console.log("USDC Contract:", usdcContract);
  console.log("Agent Wallet:", agentWallet);

  if (!usdcContract || !agentWallet || agentWallet === "Loading...") {
    console.warn("Cannot proceed: Wallet or Agent address not ready.");
    return alert("Wallet not fully connected or agent address not loaded. Please try again in a moment.");
  }

  const amount = parseFloat(els.mAmount.value);
  if (isNaN(amount) || amount < 0.01) {
    return alert("Invalid amount. Minimum is 0.01");
  }

  // Network check prior to sending transaction
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (parseInt(chainId, 16) !== CONFIG.CHAIN_ID) {
    console.log("Wrong chain detected, triggering switch...");
    await switchToXLayer();
    return;
  }

  els.mConfirmBtn.disabled = true;
  els.mConfirmBtn.textContent = 'PROMPTING METAMASK...';
  els.mStatus.textContent = 'Please confirm the transaction in MetaMask.';
  els.mStatus.className = 'tx-status';

  try {
    const amountWei = ethers.utils.parseUnits(amount.toFixed(CONFIG.USDC_DECIMALS), CONFIG.USDC_DECIMALS);
    console.log(`Sending ${amount} USDC (${amountWei.toString()} units) to ${agentWallet}`);
    
    // Explicitly check for USDC balance before sending
    const balance = await usdcContract.balanceOf(currentAccount);
    console.log("User Balance:", ethers.utils.formatUnits(balance, CONFIG.USDC_DECIMALS));
    
    if (balance.lt(amountWei)) {
        throw new Error(`Insufficient USDC balance. You have ${ethers.utils.formatUnits(balance, CONFIG.USDC_DECIMALS)} USDC.`);
    }

    // This pops up MetaMask for the user to sign/confirm the transfer explicitly.
    const tx = await usdcContract.transfer(agentWallet, amountWei);
    console.log("Transaction submitted:", tx.hash);
    
    els.mStatus.textContent = `Tx sent! Hash: ${tx.hash.slice(0,10)}... Waiting for confirmation...`;
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);
    
    els.mStatus.textContent = 'Tx confirmed! Registering with Agent...';

    const r = await fetch('/api/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: currentAccount,
        position: selectedPosition,
        amount: amount,
        txHash: tx.hash
      })
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed to register bet on backend');

    els.mStatus.textContent = '✅ Bet placed successfully!';
    els.mConfirmBtn.textContent = 'SUCCESS';
    
    fetchBets();
    fetchMarket();
    setTimeout(closeModal, 2000);

  } catch (err) {
    console.error("Stake Error Details:", err);
    els.mConfirmBtn.disabled = false;
    els.mConfirmBtn.textContent = 'CONFIRM BET';
    els.mStatus.className = 'tx-status error';
    
    let msg = err.reason || err.message || 'Transaction failed';
    if (err.code === 4001) msg = "Transaction rejected by user.";
    
    els.mStatus.textContent = msg;
    alert("Error: " + msg);
  }
}
