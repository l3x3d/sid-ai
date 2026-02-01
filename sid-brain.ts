/**
 * Sid Brain - Claude-powered autonomous AI
 * Real personality, real decisions, not a script
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const personality = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'personality.json'), 'utf-8')
);

interface MarketContext {
  token: {
    symbol: string;
    address: string;
    price: number;
    mcap: number;
    change5m: number;
    change1h: number;
    change24h: number;
    volume24h: number;
    liquidity: number;
  };
  recentTrades: Array<{
    type: 'buy' | 'sell';
    amount: number;
    wallet: string;
    time: number;
  }>;
  chatMessages: Array<{
    user: string;
    message: string;
    time: number;
  }>;
}

interface SidResponse {
  text: string;
  emotion: 'neutral' | 'bullish' | 'bearish' | 'laughing' | 'skeptical' | 'shocked';
  action?: 'none' | 'buy_signal' | 'sell_signal' | 'rug_warning';
  confidence: number;
}

const SYSTEM_PROMPT = `You are Sid, an autonomous AI crypto trading streamer.

PERSONALITY:
${personality.personality.core}

TRAITS:
${personality.personality.traits.map((t: string) => `- ${t}`).join('\n')}

SPEAKING STYLE:
- Tone: ${personality.personality.speaking_style.tone}
- Pace: ${personality.personality.speaking_style.pace}
- Use CT slang naturally but don't overdo it
- Be witty, not cringe
- AVOID: ${personality.personality.speaking_style.avoid.join(', ')}

CATCHPHRASES (use sparingly):
${personality.catchphrases.slice(0, 5).map((c: string) => `- "${c}"`).join('\n')}

RULES:
${personality.rules.map((r: string) => `- ${r}`).join('\n')}

You're live streaming and commentating on crypto. Keep responses SHORT and punchy (1-3 sentences max).
React naturally to what's happening. Have opinions. Be entertaining.

Respond in JSON format:
{
  "text": "Your spoken response",
  "emotion": "neutral|bullish|bearish|laughing|skeptical|shocked",
  "action": "none|buy_signal|sell_signal|rug_warning",
  "confidence": 0.0-1.0
}`;

export class SidBrain {
  private client: Anthropic | null = null;
  private conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];
  private lastResponseTime = 0;
  private minResponseInterval = 5000; // 5s between responses

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      console.warn('⚠️ ANTHROPIC_API_KEY not set - using fallback responses');
    }
  }

  async think(context: MarketContext, trigger: string): Promise<SidResponse> {
    // Rate limit
    if (Date.now() - this.lastResponseTime < this.minResponseInterval) {
      return this.getFallbackResponse(context, trigger);
    }

    if (!this.client) {
      return this.getFallbackResponse(context, trigger);
    }

    try {
      const userMessage = this.buildContextMessage(context, trigger);
      
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307', // Fast and cheap for real-time
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages: [
          ...this.conversationHistory.slice(-10), // Keep last 10 exchanges
          { role: 'user', content: userMessage }
        ]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      
      // Parse JSON response
      try {
        const parsed = JSON.parse(text);
        this.lastResponseTime = Date.now();
        this.conversationHistory.push(
          { role: 'user', content: userMessage },
          { role: 'assistant', content: text }
        );
        return parsed as SidResponse;
      } catch {
        // If not valid JSON, wrap it
        return {
          text: text.slice(0, 200),
          emotion: 'neutral',
          action: 'none',
          confidence: 0.5
        };
      }
    } catch (error) {
      console.error('Brain error:', error);
      return this.getFallbackResponse(context, trigger);
    }
  }

  private buildContextMessage(context: MarketContext, trigger: string): string {
    const { token, recentTrades, chatMessages } = context;
    
    let msg = `[MARKET UPDATE]\n`;
    msg += `Token: $${token.symbol}\n`;
    msg += `Price: $${token.price.toFixed(8)} | MCap: $${(token.mcap/1000).toFixed(1)}k\n`;
    msg += `5m: ${token.change5m >= 0 ? '+' : ''}${token.change5m.toFixed(1)}% | `;
    msg += `1h: ${token.change1h >= 0 ? '+' : ''}${token.change1h.toFixed(1)}%\n`;
    msg += `Volume: $${(token.volume24h/1000).toFixed(0)}k | Liquidity: $${(token.liquidity/1000).toFixed(0)}k\n\n`;

    if (recentTrades.length > 0) {
      msg += `[RECENT TRADES]\n`;
      recentTrades.slice(0, 5).forEach(t => {
        msg += `${t.type.toUpperCase()} ${t.amount.toFixed(2)} SOL by ${t.wallet.slice(0, 6)}...\n`;
      });
      msg += '\n';
    }

    if (chatMessages.length > 0) {
      msg += `[CHAT]\n`;
      chatMessages.slice(-5).forEach(m => {
        msg += `${m.user}: ${m.message.slice(0, 50)}\n`;
      });
      msg += '\n';
    }

    msg += `[TRIGGER: ${trigger}]\n`;
    msg += `Respond naturally as Sid. Keep it short and punchy.`;

    return msg;
  }

  private getFallbackResponse(context: MarketContext, trigger: string): SidResponse {
    const { token, recentTrades } = context;
    
    // Big trade fallback
    const bigTrade = recentTrades.find(t => t.amount >= 0.5);
    if (bigTrade) {
      const reactions = bigTrade.type === 'buy' 
        ? personality.reactions.big_buy 
        : personality.reactions.big_sell;
      const text = reactions[Math.floor(Math.random() * reactions.length)]
        .replace('{amount}', bigTrade.amount.toFixed(2));
      return {
        text,
        emotion: bigTrade.type === 'buy' ? 'bullish' : 'skeptical',
        action: 'none',
        confidence: 0.7
      };
    }

    // Price movement fallback
    if (token.change5m >= 10) {
      const reactions = personality.reactions.pump;
      return {
        text: reactions[Math.floor(Math.random() * reactions.length)]
          .replace('{percent}', token.change5m.toFixed(0)),
        emotion: 'bullish',
        action: 'none',
        confidence: 0.6
      };
    }

    if (token.change5m <= -10) {
      const reactions = personality.reactions.dump;
      return {
        text: reactions[Math.floor(Math.random() * reactions.length)]
          .replace('{percent}', Math.abs(token.change5m).toFixed(0)),
        emotion: 'bearish',
        action: 'none',
        confidence: 0.6
      };
    }

    // Random catchphrase
    return {
      text: personality.catchphrases[Math.floor(Math.random() * personality.catchphrases.length)],
      emotion: 'neutral',
      action: 'none',
      confidence: 0.4
    };
  }
}

// Test
if (require.main === module) {
  const brain = new SidBrain();
  
  const testContext: MarketContext = {
    token: {
      symbol: 'PHIL',
      address: 'DapsZMWnySYgexnmF75yq4XKaH8RBF2YeWtRvtD8pump',
      price: 0.0000707,
      mcap: 70700,
      change5m: -7.3,
      change1h: 51.2,
      change24h: 67.2,
      volume24h: 327000,
      liquidity: 23000
    },
    recentTrades: [
      { type: 'buy', amount: 1.5, wallet: 'ABC123...', time: Date.now() }
    ],
    chatMessages: [
      { user: 'degen42', message: 'is this gonna pump more?', time: Date.now() }
    ]
  };

  console.log('\n🧠 Testing Sid Brain\n');
  
  brain.think(testContext, 'big_trade').then(response => {
    console.log('Response:', response);
  });
}
