import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { startScheduler } from './scheduler.js';
import { recordEntry } from './agent.js';
import { loadMarket, loadBets, loadHistory } from './db.js';
import { getAgentAddress, getAgentBalance } from './wallet-api.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

export const wss = new WebSocketServer({ server });

export function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.get('/api/market', (req, res) => {
  res.json(loadMarket() || {});
});

app.get('/api/bets', (req, res) => {
  res.json(loadBets() || []);
});

app.get('/api/history', (req, res) => {
  res.json(loadHistory() || []);
});

app.get('/api/price', async (req, res) => {
  const { getBTCPrice } = await import('./market-api.js');
  const price = await getBTCPrice();
  res.json({ price });
});

app.get('/api/agent-wallet', async (req, res) => {
  const address = getAgentAddress();
  const balance = await getAgentBalance();
  res.json({ address, balance });
});

app.post('/api/bet', async (req, res) => {
  try {
    const { wallet, position, amount, txHash } = req.body;
    
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    if (!position || !['YES', 'NO'].includes(position.toUpperCase())) {
      return res.status(400).json({ error: 'Position must be YES or NO' });
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const result = await recordEntry({ 
      wallet: wallet.toLowerCase(), 
      position: position.toUpperCase(), 
      amount, 
      txHash 
    });
    
    broadcast({ type: 'MARKET_UPDATED', market: result.market });
    res.json({ success: true, bet: result.bet, market: result.market });
  } catch (err) {
    console.error('Entry error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    agentWallet: getAgentAddress() || 'not set'
  });
});

wss.on('connection', (ws) => {
  console.log('Browser connected to live feed');
});

// Only start the server and scheduler if this file is run directly
const isMain = process.argv[1] && (path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)));

if (isMain) {
  startScheduler();
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║   CryptoCall Agent is LIVE 🚀             ║
║   http://localhost:${PORT}                   ║
║   USDC Agent Wallet mode active           ║
╚═══════════════════════════════════════════╝
    `);
  });
}

