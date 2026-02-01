#!/usr/bin/env npx tsx
/**
 * SID - AI Livestream Trading Bot
 * 
 * Phil clone but sharper. Reads trades, generates commentary, speaks live.
 * 
 * Usage:
 *   npx tsx src/sid/sid.ts <token_address>
 *   
 * Environment:
 *   ELEVENLABS_API_KEY - For TTS (optional, uses console if not set)
 */

import { PumpChatScraper, ChatMessage, fetchPumpChat } from './chat-scraper';
import { generateResponse } from './ai-brain';
import { textToSpeech, textToSpeechStream } from './voice';
import * as fs from 'fs';
import * as path from 'path';

interface TokenData {
  symbol: string;
  price: number;
  mcap: number;
  priceChange1h?: number;
  volume24h?: number;
}

interface SidState {
  tokenAddress: string;
  tokenData: TokenData;
  recentTrades: { type: 'buy' | 'sell'; amount: number; user: string; time: number }[];
  recentMessages: { user: string; text: string; time: number }[];
  lastSpoke: number;
  speakQueue: string[];
  isSpeaking: boolean;
}

const state: SidState = {
  tokenAddress: '',
  tokenData: { symbol: '', price: 0, mcap: 0 },
  recentTrades: [],
  recentMessages: [],
  lastSpoke: 0,
  speakQueue: [],
  isSpeaking: false
};

// Minimum time between Sid speaking (ms)
const MIN_SPEAK_INTERVAL = 8000;

// Output directory for audio files
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

async function fetchTokenData(address: string): Promise<TokenData | null> {
  try {
    const resp = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${address}`);
    const data = await resp.json() as any[];
    if (!data?.[0]) return null;
    
    const p = data[0];
    return {
      symbol: p.baseToken?.symbol || 'UNKNOWN',
      price: parseFloat(p.priceUsd || '0'),
      mcap: p.marketCap || 0,
      priceChange1h: p.priceChange?.h1,
      volume24h: p.volume?.h24
    };
  } catch {
    return null;
  }
}

function log(msg: string) {
  const time = new Date().toISOString().slice(11, 19);
  console.log(`[${time}] ${msg}`);
}

async function speak(text: string) {
  state.speakQueue.push(text);
  processQueue();
}

async function processQueue() {
  if (state.isSpeaking || state.speakQueue.length === 0) return;
  
  state.isSpeaking = true;
  const text = state.speakQueue.shift()!;
  
  console.log(`\n🎙️  SID: "${text}"\n`);
  
  // Try TTS if available
  if (process.env.ELEVENLABS_API_KEY) {
    const audioPath = path.join(audioDir, `sid-${Date.now()}.mp3`);
    const result = await textToSpeech(text, audioPath);
    if (result) {
      log(`🔊 Audio: ${audioPath}`);
      // In a real setup, this would play through OBS audio source
      // For now, could use: exec(`mpv --no-video ${audioPath}`)
    }
  }
  
  state.lastSpoke = Date.now();
  state.isSpeaking = false;
  
  // Process next in queue after delay
  setTimeout(() => processQueue(), 2000);
}

function onTrade(msg: ChatMessage) {
  const match = msg.text.match(/(BUY|SELL)\s+([\d.]+)\s+SOL/);
  if (!match) return;
  
  const type = match[1].toLowerCase() as 'buy' | 'sell';
  const amount = parseFloat(match[2]);
  
  state.recentTrades.push({
    type,
    amount,
    user: msg.user,
    time: Date.now()
  });
  
  // Keep only last 20 trades
  if (state.recentTrades.length > 20) {
    state.recentTrades.shift();
  }
  
  log(`📊 ${type.toUpperCase()} ${amount} SOL by ${msg.user}`);
  
  // Generate response
  maybeSpeak();
}

function onChatMessage(msg: ChatMessage) {
  state.recentMessages.push({
    user: msg.user,
    text: msg.text,
    time: Date.now()
  });
  
  // Keep only last 10 messages
  if (state.recentMessages.length > 10) {
    state.recentMessages.shift();
  }
  
  log(`💬 [${msg.user}]: ${msg.text.slice(0, 50)}`);
  
  // Generate response
  maybeSpeak();
}

function maybeSpeak() {
  // Rate limit
  if (Date.now() - state.lastSpoke < MIN_SPEAK_INTERVAL) return;
  if (state.speakQueue.length >= 3) return; // Don't queue too much
  
  const response = generateResponse({
    recentMessages: state.recentMessages.map(m => ({ user: m.user, text: m.text })),
    recentTrades: state.recentTrades.map(t => ({ type: t.type, amount: t.amount, user: t.user })),
    marketData: state.tokenData
  });
  
  if (response) {
    speak(response);
  }
}

async function updateMarketData() {
  const data = await fetchTokenData(state.tokenAddress);
  if (data) {
    state.tokenData = data;
  }
}

async function main() {
  const tokenAddress = process.argv[2];
  
  if (!tokenAddress) {
    console.log(`
🤖 SID - AI Livestream Trading Bot

Usage:
  npx tsx src/sid/sid.ts <token_address>

Example:
  npx tsx src/sid/sid.ts DapsZMWnySYgexnmF75yq4XKaH8RBF2YeWtRvtD8pump

Environment:
  ELEVENLABS_API_KEY - For voice output (optional)
`);
    return;
  }
  
  state.tokenAddress = tokenAddress;
  
  // Initial data fetch
  log('🔍 Fetching token data...');
  await updateMarketData();
  
  if (!state.tokenData.symbol) {
    console.error('❌ Failed to fetch token data');
    return;
  }
  
  console.log(`
╔══════════════════════════════════════════╗
║         🤖 SID IS ONLINE                 ║
╠══════════════════════════════════════════╣
║  Token: $${state.tokenData.symbol.padEnd(10)} MCap: $${(state.tokenData.mcap / 1000).toFixed(0)}k
║  1h Change: ${(state.tokenData.priceChange1h || 0) >= 0 ? '+' : ''}${(state.tokenData.priceChange1h || 0).toFixed(1)}%
║  Volume: $${((state.tokenData.volume24h || 0) / 1000).toFixed(0)}k (24h)
╚══════════════════════════════════════════╝
`);

  // Opening line
  speak(`Yo what's up, Sid here! We're watching $${state.tokenData.symbol} today, sitting at ${(state.tokenData.mcap / 1000).toFixed(0)}k market cap. Let's see what the degens are doing.`);
  
  // Connect to trade feed
  const scraper = new PumpChatScraper(tokenAddress, onTrade);
  
  try {
    await scraper.connect();
    log('👂 Listening for trades...');
  } catch (e) {
    log('⚠️  WebSocket failed, using polling mode');
  }
  
  // Poll for chat messages (pump.fun chat API)
  setInterval(async () => {
    const messages = await fetchPumpChat(tokenAddress);
    const newMessages = messages.filter(m => 
      !state.recentMessages.find(rm => rm.text === m.text && rm.user === m.user)
    );
    newMessages.forEach(m => onChatMessage(m));
  }, 10000);
  
  // Update market data periodically
  setInterval(updateMarketData, 30000);
  
  // Periodic commentary
  setInterval(() => {
    if (Math.random() < 0.3) {
      maybeSpeak();
    }
  }, 45000);
  
  // Keep alive
  console.log('\n📡 Sid is live! Press Ctrl+C to stop.\n');
}

main().catch(console.error);
