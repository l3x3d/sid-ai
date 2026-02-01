#!/usr/bin/env npx tsx
/**
 * SID - Autonomous AI Streamer
 * 
 * Full AI agent with voice, 3D avatar, and real personality.
 * Not a Phil clone - Sid is his own entity.
 * 
 * Usage:
 *   ELEVENLABS_API_KEY=xxx npx tsx src/sid/sid-main.ts [token_address]
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { SidBrain } from './sid-brain';
import { PumpChatScraper, fetchPumpChat, ChatMessage } from './chat-scraper';
import { textToSpeech } from './voice';

// Config
const PORT = 3456;
const AUDIO_DIR = path.join(__dirname, 'audio');

interface TokenData {
  symbol: string;
  address: string;
  price: number;
  mcap: number;
  change5m: number;
  change1h: number;
  change24h: number;
  volume24h: number;
  liquidity: number;
}

interface SidState {
  isLive: boolean;
  token: TokenData | null;
  recentTrades: Array<{ type: 'buy' | 'sell'; amount: number; wallet: string; time: number }>;
  chatMessages: Array<{ user: string; message: string; time: number }>;
  speechQueue: Array<{ text: string; emotion: string; audio?: string }>;
  isSpeaking: boolean;
  lastSpokeAt: number;
  clients: Set<http.ServerResponse>;
}

const state: SidState = {
  isLive: false,
  token: null,
  recentTrades: [],
  chatMessages: [],
  speechQueue: [],
  isSpeaking: false,
  lastSpokeAt: 0,
  clients: new Set()
};

const brain = new SidBrain();

// Ensure audio directory
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// ============ TOKEN DATA ============

async function fetchTokenData(address: string): Promise<TokenData | null> {
  try {
    const resp = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${address}`);
    const data = await resp.json() as any[];
    if (!data?.[0]) return null;
    
    const p = data[0];
    return {
      symbol: p.baseToken?.symbol || 'UNKNOWN',
      address,
      price: parseFloat(p.priceUsd || '0'),
      mcap: p.marketCap || 0,
      change5m: p.priceChange?.m5 || 0,
      change1h: p.priceChange?.h1 || 0,
      change24h: p.priceChange?.h24 || 0,
      volume24h: p.volume?.h24 || 0,
      liquidity: p.liquidity?.usd || 0
    };
  } catch {
    return null;
  }
}

// ============ SPEECH ============

async function speak(text: string, emotion: string = 'neutral') {
  state.speechQueue.push({ text, emotion });
  processSpeechQueue();
}

async function processSpeechQueue() {
  if (state.isSpeaking || state.speechQueue.length === 0) return;
  
  state.isSpeaking = true;
  const item = state.speechQueue.shift()!;
  
  console.log(`\n🎙️  SID [${item.emotion}]: "${item.text}"\n`);
  
  // Generate audio if ElevenLabs key available
  if (process.env.ELEVENLABS_API_KEY) {
    const audioPath = path.join(AUDIO_DIR, `sid-${Date.now()}.mp3`);
    await textToSpeech(item.text, audioPath);
    item.audio = audioPath;
  }
  
  // Broadcast to all connected clients
  broadcastToClients({
    type: 'speak',
    text: item.text,
    emotion: item.emotion,
    audio: item.audio
  });
  
  state.lastSpokeAt = Date.now();
  
  // Wait for speech duration (estimate 100ms per word)
  const duration = Math.max(3000, item.text.split(' ').length * 200);
  await new Promise(r => setTimeout(r, duration));
  
  state.isSpeaking = false;
  processSpeechQueue();
}

function broadcastToClients(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of state.clients) {
    try {
      client.write(message);
    } catch {
      state.clients.delete(client);
    }
  }
}

// ============ EVENT HANDLERS ============

async function onTrade(trade: { type: 'buy' | 'sell'; amount: number; wallet: string }) {
  state.recentTrades.unshift({ ...trade, time: Date.now() });
  state.recentTrades = state.recentTrades.slice(0, 20);
  
  console.log(`📊 ${trade.type.toUpperCase()} ${trade.amount.toFixed(2)} SOL`);
  
  // React to significant trades
  if (trade.amount >= 0.5) {
    await react('big_trade');
  }
}

async function onChat(msg: { user: string; message: string }) {
  state.chatMessages.push({ ...msg, time: Date.now() });
  state.chatMessages = state.chatMessages.slice(-10);
  
  console.log(`💬 [${msg.user}]: ${msg.message.slice(0, 50)}`);
  
  // Occasionally react to chat
  if (Math.random() < 0.3) {
    await react('chat_message');
  }
}

async function onPriceChange() {
  if (!state.token) return;
  
  if (state.token.change5m >= 15) {
    await react('pump');
  } else if (state.token.change5m <= -15) {
    await react('dump');
  }
}

async function react(trigger: string) {
  if (!state.token) return;
  if (Date.now() - state.lastSpokeAt < 8000) return; // Rate limit
  
  const response = await brain.think({
    token: state.token,
    recentTrades: state.recentTrades,
    chatMessages: state.chatMessages
  }, trigger);
  
  if (response.text) {
    await speak(response.text, response.emotion);
    
    // Broadcast emotion change
    broadcastToClients({ type: 'emotion', emotion: response.emotion });
  }
}

// ============ HTTP SERVER ============

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  
  // Avatar page
  if (url.pathname === '/' || url.pathname === '/avatar') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(path.join(__dirname, 'avatar/index.html')));
    return;
  }
  
  // Server-Sent Events for real-time updates
  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    state.clients.add(res);
    req.on('close', () => state.clients.delete(res));
    return;
  }
  
  // Status
  if (url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      isLive: state.isLive,
      token: state.token?.symbol,
      mcap: state.token?.mcap,
      recentTrades: state.recentTrades.length,
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
  res.end('Not found');
});

// ============ MAIN ============

async function main() {
  const tokenAddress = process.argv[2] || 'DapsZMWnySYgexnmF75yq4XKaH8RBF2YeWtRvtD8pump';
  
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                    🤖 SID IS BOOTING UP                  ║
╠══════════════════════════════════════════════════════════╣
║  Autonomous AI Streamer                                  ║
║  Voice: ${process.env.ELEVENLABS_API_KEY ? '✅ ElevenLabs' : '❌ No API key'}                            ║
║  Brain: ${process.env.ANTHROPIC_API_KEY ? '✅ Claude' : '⚠️  Fallback mode'}                                ║
╚══════════════════════════════════════════════════════════╝
  `);
  
  // Fetch initial token data
  console.log('🔍 Fetching token data...');
  state.token = await fetchTokenData(tokenAddress);
  
  if (!state.token) {
    console.error('❌ Failed to fetch token data');
    return;
  }
  
  console.log(`📊 Watching: $${state.token.symbol} | MCap: $${(state.token.mcap/1000).toFixed(0)}k`);
  
  // Start HTTP server for avatar
  server.listen(PORT, () => {
    console.log(`\n🌐 Avatar: http://localhost:${PORT}`);
    console.log(`   Add as OBS Browser Source for streaming\n`);
  });
  
  // Connect to trade feed
  const scraper = new PumpChatScraper(tokenAddress, (msg) => {
    const match = msg.text.match(/(BUY|SELL)\s+([\d.]+)\s+SOL/);
    if (match) {
      onTrade({
        type: match[1].toLowerCase() as 'buy' | 'sell',
        amount: parseFloat(match[2]),
        wallet: msg.user
      });
    }
  });
  
  try {
    await scraper.connect();
    console.log('👂 Connected to trade feed');
  } catch {
    console.log('⚠️  Trade feed unavailable, using polling');
  }
  
  // Poll for chat
  setInterval(async () => {
    const messages = await fetchPumpChat(tokenAddress);
    const newMsgs = messages.filter(m => 
      !state.chatMessages.find(cm => cm.message === m.text && cm.user === m.user)
    );
    for (const msg of newMsgs) {
      onChat({ user: msg.user, message: msg.text });
    }
  }, 15000);
  
  // Update market data
  setInterval(async () => {
    const newData = await fetchTokenData(tokenAddress);
    if (newData) {
      const prevChange = state.token?.change5m || 0;
      state.token = newData;
      
      // Check for significant price movement
      if (Math.abs(newData.change5m - prevChange) > 10) {
        onPriceChange();
      }
    }
  }, 20000);
  
  // Periodic commentary
  setInterval(() => {
    if (Math.random() < 0.2 && Date.now() - state.lastSpokeAt > 30000) {
      react('periodic');
    }
  }, 45000);
  
  // Go live
  state.isLive = true;
  
  // Opening line
  await speak(
    `Yo, Sid here! We're live watching $${state.token.symbol}, sitting at ${(state.token.mcap/1000).toFixed(0)}k market cap. Let's see what the degens are cooking.`,
    'neutral'
  );
  
  console.log('\n📡 SID IS LIVE! Press Ctrl+C to stop.\n');
}

main().catch(console.error);
