/**
 * Sid's AI Brain
 * Generates responses based on chat messages and market data
 */

import * as fs from 'fs';
import * as path from 'path';

interface Persona {
  name: string;
  personality: string;
  voice: { style: string; catchphrases: string[] };
  rules: string[];
}

interface MarketData {
  symbol: string;
  price: number;
  mcap: number;
  priceChange1h?: number;
  volume24h?: number;
}

interface ChatContext {
  recentMessages: { user: string; text: string }[];
  recentTrades: { type: 'buy' | 'sell'; amount: number; user: string }[];
  marketData: MarketData;
}

// Load persona
const personaPath = path.join(__dirname, 'persona.json');
const persona: Persona = JSON.parse(fs.readFileSync(personaPath, 'utf-8'));

// Simple response generation (can upgrade to GPT/Claude later)
export function generateResponse(context: ChatContext): string | null {
  const { recentMessages, recentTrades, marketData } = context;
  
  // Priority 1: React to big trades
  const bigTrade = recentTrades.find(t => t.amount >= 0.5);
  if (bigTrade) {
    if (bigTrade.type === 'buy') {
      const responses = [
        `Whale alert! ${bigTrade.amount.toFixed(2)} SOL buy just hit. Someone knows something or someone's about to get rekt.`,
        `${bigTrade.amount.toFixed(2)} SOL buy coming in hot. That's not a degen bet, that's conviction.`,
        `Big money moving - ${bigTrade.amount.toFixed(2)} SOL. Let's see if the chart follows.`,
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    } else {
      const responses = [
        `${bigTrade.amount.toFixed(2)} SOL sell. Paper hands or profit taking? Time will tell.`,
        `Someone just dumped ${bigTrade.amount.toFixed(2)} SOL. Don't panic - could be early profit.`,
        `Sell pressure at ${bigTrade.amount.toFixed(2)} SOL. Chart's about to tell us if this was smart or early.`,
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }
  
  // Priority 2: React to chat messages
  const lastMessage = recentMessages[recentMessages.length - 1];
  if (lastMessage) {
    const text = lastMessage.text.toLowerCase();
    
    if (text.includes('rug') || text.includes('scam')) {
      return `${lastMessage.user} asking the real questions. Look, I can't tell the future, but check the dev wallet and liquidity before you ape.`;
    }
    
    if (text.includes('moon') || text.includes('100x')) {
      return `${lastMessage.user} calling moon already? I like the energy but let's see some volume first.`;
    }
    
    if (text.includes('buy') || text.includes('ape')) {
      return `${lastMessage.user} looking to ape. Not financial advice, but the chart's looking ${marketData.priceChange1h && marketData.priceChange1h > 0 ? 'bullish' : 'choppy'} right now.`;
    }
    
    if (text.includes('?')) {
      return `${lastMessage.user} asking questions - love to see it. DYOR is not just a meme, it's survival.`;
    }
  }
  
  // Priority 3: Market commentary (periodic)
  if (Math.random() < 0.3) {
    if (marketData.priceChange1h && marketData.priceChange1h > 20) {
      return `${marketData.symbol} up ${marketData.priceChange1h.toFixed(0)}% in the last hour. This is what we came for.`;
    }
    if (marketData.priceChange1h && marketData.priceChange1h < -15) {
      return `Chart's taking a breather, down ${Math.abs(marketData.priceChange1h).toFixed(0)}%. Could be a dip buy or could go lower. Your call.`;
    }
    if (marketData.volume24h && marketData.volume24h > 100000) {
      return `Volume looking healthy at $${(marketData.volume24h / 1000).toFixed(0)}k. That's the lifeblood of any pump.`;
    }
  }
  
  // Random catchphrase occasionally
  if (Math.random() < 0.1) {
    return persona.voice.catchphrases[Math.floor(Math.random() * persona.voice.catchphrases.length)];
  }
  
  return null; // Nothing to say right now
}

// Test
if (require.main === module) {
  const testContext: ChatContext = {
    recentMessages: [
      { user: 'degen123', text: 'is this gonna moon?' },
      { user: 'whale_watcher', text: 'big buy incoming' }
    ],
    recentTrades: [
      { type: 'buy', amount: 1.5, user: 'whale123' }
    ],
    marketData: {
      symbol: 'PHIL',
      price: 0.0000723,
      mcap: 72334,
      priceChange1h: 136,
      volume24h: 327617
    }
  };

  console.log('\n🧠 Testing Sid AI Brain\n');
  
  for (let i = 0; i < 5; i++) {
    const response = generateResponse(testContext);
    if (response) {
      console.log(`💬 Sid: "${response}"\n`);
    }
  }
}
