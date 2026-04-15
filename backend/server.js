import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { startScheduler } from './scheduler.js';
import { recordEntry } from './agent.js';
import { loadMarkets, loadBets, loadHistory, loadAgentPerformance } from './db.js';
import { getAgentAddress, getAgentBalance } from './wallet-api.js';
import { getPrice } from './market-api.js';
import { AgentManager } from './agents/index.js';

dotenv.config();

// Initialize Agent Manager
const agentManager = new AgentManager();
agentManager.initializeDefaultAgents();

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
  res.json(loadMarkets() || []);
});

app.get('/api/bets', (req, res) => {
  res.json(loadBets() || []);
});

app.get('/api/history', (req, res) => {
  res.json(loadHistory() || []);
});

app.get('/api/price', async (req, res) => {
  const symbol = req.query.symbol || 'BTC';
  const price = await getPrice(symbol);
  res.json({ symbol, price });
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
      txHash,
      marketId: req.body.marketId
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
    agentWallet: getAgentAddress() || 'not set',
    agentManager: agentManager.getStatus()
  });
});

// Agent Manager API Routes

// Get all agents
app.get('/api/agents', (req, res) => {
  const agents = agentManager.getAllAgents().map(agent => agent.getStats());
  res.json({ success: true, agents });
});

// Get agent by ID
app.get('/api/agents/:id', (req, res) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json({ success: true, agent: agent.getStats() });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = agentManager.getLeaderboard();
  res.json({ success: true, ...leaderboard });
});

// Start/stop agent manager
app.post('/api/agents/control', (req, res) => {
  const { action } = req.body;
  
  if (action === 'start') {
    agentManager.start();
    res.json({ success: true, message: 'Agent manager started' });
  } else if (action === 'stop') {
    agentManager.stop();
    res.json({ success: true, message: 'Agent manager stopped' });
  } else {
    res.status(400).json({ error: 'Invalid action. Use start or stop' });
  }
});

// Pause/resume specific agent
app.post('/api/agents/:id/control', (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  
  if (action === 'pause') {
    agentManager.pauseAgent(id);
    res.json({ success: true, message: 'Agent paused' });
  } else if (action === 'resume') {
    agentManager.resumeAgent(id);
    res.json({ success: true, message: 'Agent resumed' });
  } else if (action === 'remove') {
    agentManager.removeAgent(id);
    res.json({ success: true, message: 'Agent removed' });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

wss.on('connection', (ws) => {
  console.log('Browser connected to live feed');
});

// Only start the server and scheduler if this file is run directly
const isMain = process.argv[1] && (path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)));

if (isMain) {
  startScheduler(agentManager);
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║   🤖 AI AGENT TRADING SYSTEM LIVE 🚀                      ║
║   http://localhost:${PORT}                                  ║
║   Polymarket Prediction Market + AI Trading Agents        ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
}

export default app;
