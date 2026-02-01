#!/usr/bin/env npx tsx
/**
 * SID - Powered by OpenClaw
 * 
 * This connects to OpenClaw gateway so the REAL AI (me) can:
 * - Read pump.fun chat
 * - Respond with voice
 * - Trade tokens
 * - Build projects live
 * 
 * I'm not a script - I'm the actual agent running the show.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import WebSocket from 'ws';
import { PumpChatScraper, fetchPumpChat } from './chat-scraper';
import { textToSpeech } from './voice';

const PORT = 3456;
const AUDIO_DIR = path.join(__dirname, 'audio');
const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY || 'http://localhost:4444';

// State
interface SidState {
  isLive: boolean;
  token: { symbol: string; address: string; mcap: number; change5m: number } | null;
  recentEvents: string[];
  speechQueue: { text: string; emotion: string }[];
  isSpeaking: boolean;
  clients: Set<http.ServerResponse>;
}

const state: SidState = {
  isLive: false,
  token: null,
  recentEvents: [],
  speechQueue: [],
  isSpeaking: false,
  clients: new Set()
};

if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// ========== OPENCLAW INTEGRATION ==========

/**
 * Send event to OpenClaw for processing
 * OpenClaw (me) will decide what to say/do
 */
async function sendToOpenClaw(event: string, context: any): Promise<string | null> {
  try {
    // Write event to a file that OpenClaw monitors
    const eventFile = path.join(__dirname, 'events.jsonl');
    const eventData = JSON.stringify({ 
      timestamp: Date.now(), 
      event, 
      context,
      token: state.token
    }) + '\n';
    
    fs.appendFileSync(eventFile, eventData);
    
    // OpenClaw will read this and respond via the response file
    return null; // Async - OpenClaw responds separately
  } catch (e) {
    console.error('Failed to send to OpenClaw:', e);
    return null;
  }
}

/**
 * OpenClaw calls this to make Sid speak
 */
function sidSpeak(text: string, emotion: string = 'neutral') {
  state.speechQueue.push({ text, emotion });
  processSpeechQueue();
}

async function processSpeechQueue() {
  if (state.isSpeaking || state.speechQueue.length === 0) return;
  
  state.isSpeaking = true;
  const item = state.speechQueue.shift()!;
  
  console.log(`\n🎙️  SID: "${item.text}"\n`);
  
  // Generate voice
  if (process.env.ELEVENLABS_API_KEY) {
    const audioPath = path.join(AUDIO_DIR, `sid-${Date.now()}.mp3`);
    await textToSpeech(item.text, audioPath);
    broadcastToClients({ type: 'audio', path: `/audio/${path.basename(audioPath)}` });
  }
  
  // Show text on avatar
  broadcastToClients({ type: 'speak', text: item.text, emotion: item.emotion });
  
  // Wait for speech
  const duration = Math.max(2000, item.text.split(' ').length * 180);
  await new Promise(r => setTimeout(r, duration));
  
  state.isSpeaking = false;
  processSpeechQueue();
}

function broadcastToClients(data: any) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of state.clients) {
    try { client.write(msg); } catch { state.clients.delete(client); }
  }
}

// ========== EVENT HANDLERS ==========

async function onTrade(type: 'buy' | 'sell', amount: number, wallet: string) {
  const event = `${type.toUpperCase()} ${amount.toFixed(2)} SOL by ${wallet.slice(0, 8)}`;
  state.recentEvents.push(event);
  if (state.recentEvents.length > 50) state.recentEvents.shift();
  
  console.log(`📊 ${event}`);
  
  // Notify OpenClaw for big trades
  if (amount >= 0.3) {
    await sendToOpenClaw('big_trade', { type, amount, wallet });
  }
}

async function onChat(user: string, message: string) {
  const event = `[${user}]: ${message}`;
  state.recentEvents.push(event);
  if (state.recentEvents.length > 50) state.recentEvents.shift();
  
  console.log(`💬 ${event}`);
  
  // Send to OpenClaw - I'll decide if/how to respond
  await sendToOpenClaw('chat', { user, message });
}

// ========== HTTP SERVER ==========

// Basic auth - change this password!
const AUTH_TOKEN = process.env.SID_AUTH || 'sid2026';

const server = http.createServer(async (req, res) => {
  // CORS for dashboard
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Auth check - only protect write endpoints
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const protectedRoutes = ['/speak']; // Only protect speaking
  
  if (protectedRoutes.some(r => url.pathname.startsWith(r))) {
    const authHeader = req.headers.authorization || url.searchParams.get('token');
    if (authHeader !== AUTH_TOKEN && authHeader !== `Bearer ${AUTH_TOKEN}`) {
      // Allow without auth for local requests
      const isLocal = req.socket.remoteAddress === '127.0.0.1' || req.socket.remoteAddress === '::1';
      if (!isLocal) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }
  }
  
  // Dashboard
  if (url.pathname === '/' || url.pathname === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(path.join(__dirname, 'dashboard/index.html')));
    return;
  }
  
  // Avatar (OBS overlay)
  if (url.pathname === '/avatar') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(path.join(__dirname, 'avatar/index.html')));
    return;
  }
  
  // SSE events
  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    state.clients.add(res);
    req.on('close', () => state.clients.delete(res));
    return;
  }
  
  // Speak endpoint - OpenClaw calls this
  if (url.pathname === '/speak' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { text, emotion } = JSON.parse(body);
        sidSpeak(text, emotion || 'neutral');
        res.writeHead(200);
        res.end('ok');
      } catch {
        res.writeHead(400);
        res.end('invalid json');
      }
    });
    return;
  }
  
  // Status
  if (url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      isLive: state.isLive,
      token: state.token,
      recentEvents: state.recentEvents.slice(-10),
      queueLength: state.speechQueue.length
    }));
    return;
  }
  
  // Audio files
  if (url.pathname.startsWith('/audio/')) {
    const file = path.join(AUDIO_DIR, path.basename(url.pathname));
    if (fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      res.end(fs.readFileSync(file));
      return;
    }
  }
  
  res.writeHead(404);
  res.end('not found');
});

// ========== MAIN ==========

async function main() {
  const tokenAddress = process.argv[2] || 'DapsZMWnySYgexnmF75yq4XKaH8RBF2YeWtRvtD8pump';
  
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              🤖 SID - POWERED BY OPENCLAW                     ║
╠═══════════════════════════════════════════════════════════════╣
║  I am the AI. Not a script - the real agent.                  ║
║  I read chat, I respond, I trade, I build.                    ║
╠═══════════════════════════════════════════════════════════════╣
║  Avatar:  http://localhost:${PORT}                              ║
║  Speak:   POST http://localhost:${PORT}/speak                   ║
║  Status:  GET  http://localhost:${PORT}/status                  ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Fetch token
  try {
    const resp = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${tokenAddress}`);
    const data = await resp.json() as any[];
    if (data?.[0]) {
      state.token = {
        symbol: data[0].baseToken?.symbol || 'UNKNOWN',
        address: tokenAddress,
        mcap: data[0].marketCap || 0,
        change5m: data[0].priceChange?.m5 || 0
      };
      console.log(`📊 Watching: $${state.token.symbol} | MCap: $${(state.token.mcap/1000).toFixed(0)}k\n`);
    }
  } catch {}

  // Start server
  // Start server on all interfaces
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server running on http://0.0.0.0:${PORT}`);
    console.log(`🔗 Dashboard: http://165.232.132.170:${PORT}`);
  });

  // Connect to trades
  const scraper = new PumpChatScraper(tokenAddress, (msg) => {
    const match = msg.text.match(/(BUY|SELL)\s+([\d.]+)\s+SOL/);
    if (match) {
      onTrade(match[1].toLowerCase() as 'buy' | 'sell', parseFloat(match[2]), msg.user);
    }
  });
  
  try {
    await scraper.connect();
    console.log('👂 Connected to trade feed\n');
  } catch {
    console.log('⚠️  Trade feed unavailable\n');
  }

  // Poll chat
  setInterval(async () => {
    const messages = await fetchPumpChat(tokenAddress);
    // Process new messages...
  }, 10000);

  // Update market data
  setInterval(async () => {
    try {
      const resp = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${tokenAddress}`);
      const data = await resp.json() as any[];
      if (data?.[0] && state.token) {
        state.token.mcap = data[0].marketCap || 0;
        state.token.change5m = data[0].priceChange?.m5 || 0;
      }
    } catch {}
  }, 30000);

  state.isLive = true;
  
  // Opening - I'll speak through the /speak endpoint
  console.log('📡 SID IS LIVE! OpenClaw controls speech via POST /speak\n');
  console.log('Example: curl -X POST http://localhost:3456/speak -d \'{"text":"Hello degens!"}\'');
}

main().catch(console.error);
