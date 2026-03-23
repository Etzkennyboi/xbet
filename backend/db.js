import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const DATA_DIR = './data';
const MARKET_FILE = path.join(DATA_DIR, 'market.json');
const BETS_FILE = path.join(DATA_DIR, 'bets.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure files exist
if (!existsSync(MARKET_FILE)) writeFileSync(MARKET_FILE, JSON.stringify(null));
if (!existsSync(BETS_FILE)) writeFileSync(BETS_FILE, JSON.stringify([]));
if (!existsSync(HISTORY_FILE)) writeFileSync(HISTORY_FILE, JSON.stringify([]));

// --- Active Markets ---
export function loadMarkets() {
  try {
    if (!existsSync(MARKET_FILE)) return [];
    const data = readFileSync(MARKET_FILE, 'utf8');
    const markets = JSON.parse(data);
    return Array.isArray(markets) ? markets : (markets ? [markets] : []);
  } catch (err) {
    console.error('Error reading market.json:', err.message);
    return [];
  }
}

export function saveMarkets(markets) {
  writeFileSync(MARKET_FILE, JSON.stringify(markets, null, 2));
}

// Backward compatibility or convenience
export const loadMarket = () => loadMarkets()[0] || null;
export const saveMarket = (m) => saveMarkets(m ? [m] : []);

/**
 * Multiple Market Helpers
 */
export function addMarket(market) {
  const markets = loadMarkets();
  markets.push(market);
  saveMarkets(markets);
}

export function updateMarket(market) {
  const markets = loadMarkets();
  const idx = markets.findIndex(m => m.id === market.id);
  if (idx !== -1) {
    markets[idx] = market;
    saveMarkets(markets);
  }
}

export function removeMarket(marketId) {
  const markets = loadMarkets();
  const filtered = markets.filter(m => m.id !== marketId);
  saveMarkets(filtered);
}


// --- Bets ---
export function loadBets(marketId = null) {
  try {
    const data = JSON.parse(readFileSync(BETS_FILE, 'utf8'));
    if (marketId) {
      return data.filter(bet => bet.marketId === marketId);
    }
    return data;
  } catch (err) {
    console.error('Error reading bets.json:', err.message);
    return [];
  }
}

export function saveBet(bet) {
  const bets = loadBets();
  bets.push(bet);
  writeFileSync(BETS_FILE, JSON.stringify(bets, null, 2));
}

export function clearBets() {
  writeFileSync(BETS_FILE, JSON.stringify([]));
}

// --- History ---
export function loadHistory() {
  try {
    const data = JSON.parse(readFileSync(HISTORY_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Error reading history.json:', err.message);
    return [];
  }
}

export function saveToHistory(resolvedMarket) {
  const history = loadHistory();
  const existingIdx = history.findIndex(m => m.id === resolvedMarket.id);
  
  if (existingIdx !== -1) {
    history[existingIdx] = resolvedMarket; // Idempotent update
  } else {
    history.push(resolvedMarket);
  }
  
  // Keep only the last 50 resolved markets to save space
  if (history.length > 50) {
    history.splice(0, history.length - 50);
  }
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}
