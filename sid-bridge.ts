/**
 * SID - AI Lobster Chatbot
 * 
 * Just vibes and chats. No trading, no signals. Pure personality.
 */

import { Telegraf } from 'telegraf';

// ============ CONFIG ============
const TELEGRAM_BOT_TOKEN = process.env.SID_TELEGRAM_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.SID_TELEGRAM_CHAT || '';
const ELEVENLABS_KEY = process.env.ELEVENLABS_KEY || 'sk_68193f7dbe4a13a056bc59b3782491dd228ce2379a89dfec';
const ELEVENLABS_VOICE = 'bIHbv24MWmeRgasZH58o'; // Will - chill surfer

// Token to watch (set when launching SID's token)
let watchedToken = process.env.PUMPFUN_TOKEN || '';

// ============ TYPES ============
interface ChatMessage {
  user: string;
  text: string;
  timestamp: number;
  wallet?: string;
  isReply?: boolean;
}

// ============ PUMP.FUN SCRAPER ============
class PumpChatBridge {
  private ws: WebSocket | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastMessageId = '';
  private seenMessages = new Set<string>();
  private bot: Telegraf;
  
  constructor(bot: Telegraf) {
    this.bot = bot;
  }

  // Poll chat messages (more reliable than websocket for chat)
  async startPolling(tokenAddress: string, intervalMs = 5000) {
    watchedToken = tokenAddress;
    console.log(`📡 Polling pump.fun chat for ${tokenAddress}`);
    
    this.pollInterval = setInterval(async () => {
      await this.fetchAndForward(tokenAddress);
    }, intervalMs);
    
    // Initial fetch
    await this.fetchAndForward(tokenAddress);
  }

  async fetchAndForward(tokenAddress: string) {
    try {
      const resp = await fetch(`https://frontend-api.pump.fun/replies/${tokenAddress}?limit=20&offset=0`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });
      
      if (!resp.ok) {
        console.error(`Chat fetch failed: ${resp.status}`);
        return;
      }
      
      const messages = await resp.json() as any[];
      
      // Process new messages (newest first, so reverse)
      for (const msg of messages.reverse()) {
        const msgId = msg.id || `${msg.user?.wallet}-${msg.created_at}`;
        
        if (this.seenMessages.has(msgId)) continue;
        this.seenMessages.add(msgId);
        
        // Keep set from growing forever
        if (this.seenMessages.size > 1000) {
          const arr = Array.from(this.seenMessages);
          this.seenMessages = new Set(arr.slice(-500));
        }
        
        const chatMsg: ChatMessage = {
          user: msg.user?.username || msg.user?.wallet?.slice(0, 6) || 'anon',
          text: msg.text || '',
          timestamp: new Date(msg.created_at).getTime(),
          wallet: msg.user?.wallet,
        };
        
        // Forward to Telegram
        await this.forwardToTelegram(chatMsg);
      }
    } catch (e: any) {
      console.error('Poll error:', e.message);
    }
  }

  async forwardToTelegram(msg: ChatMessage) {
    if (!TELEGRAM_CHAT_ID) return;
    
    const text = `💬 <b>${escapeHtml(msg.user)}</b>:\n${escapeHtml(msg.text)}`;
    
    try {
      await this.bot.telegram.sendMessage(TELEGRAM_CHAT_ID, text, {
        parse_mode: 'HTML',
      });
    } catch (e: any) {
      console.error('Telegram send failed:', e.message);
    }
  }

  // Connect to websocket for trade notifications
  async connectTrades(tokenAddress: string) {
    const wsUrl = 'wss://pumpportal.fun/api/data';
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.on('open', () => {
      console.log('🔌 Connected to pumpportal trades');
      this.ws?.send(JSON.stringify({
        method: 'subscribeTokenTrade',
        keys: [tokenAddress]
      }));
    });

    this.ws.on('message', async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.txType === 'buy' || msg.txType === 'sell') {
          const emoji = msg.txType === 'buy' ? '🟢' : '🔴';
          const sol = (msg.solAmount || 0).toFixed(3);
          const wallet = msg.traderPublicKey?.slice(0, 6) || 'anon';
          
          const text = `${emoji} <b>${msg.txType.toUpperCase()}</b> ${sol} SOL by ${wallet}`;
          
          if (TELEGRAM_CHAT_ID) {
            await this.bot.telegram.sendMessage(TELEGRAM_CHAT_ID, text, {
              parse_mode: 'HTML',
            });
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    });

    this.ws.on('close', () => {
      console.log('🔌 Trade websocket closed, reconnecting...');
      setTimeout(() => this.connectTrades(tokenAddress), 5000);
    });
  }

  stop() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.ws) this.ws.close();
  }
}

// ============ SID BRAIN ============
async function generateSidResponse(message: string): Promise<string> {
  // For now, simple pattern matching. Later: Claude API
  const lower = message.toLowerCase();
  
  if (lower.includes('gm') || lower.includes('good morning')) {
    return pickRandom([
      "Gm gm! Sid here, ready to ride some waves 🦞",
      "Gm degen! Let's catch some pumps today",
      "Yo gm! The water's looking good",
    ]);
  }
  
  if (lower.includes('price') || lower.includes('pump') || lower.includes('moon')) {
    return pickRandom([
      "Bro we're just getting started. Patience 🌊",
      "Let it cook dude. Good things take time",
      "Moon? We're going to the ocean floor first, then UP 🦞🚀",
    ]);
  }
  
  if (lower.includes('wen') || lower.includes('when')) {
    return pickRandom([
      "Wen? When the vibes are right my dude",
      "Soon™ - but for real, good things coming",
      "Patience young degen. Sid doesn't rush",
    ]);
  }
  
  if (lower.includes('sid') || lower.includes('lobster')) {
    return pickRandom([
      "You rang? 🦞",
      "Sid's here, what's good?",
      "That's me! The chillest lobster in crypto",
    ]);
  }
  
  if (lower.includes('who') && lower.includes('are')) {
    return "I'm Sid - your friendly neighborhood AI lobster. Just vibing on the blockchain 🦞";
  }
  
  // Default - don't respond to everything
  return '';
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============ TTS ============
async function textToSpeech(text: string): Promise<Buffer | null> {
  try {
    // Fix SID pronunciation
    const fixedText = text.replace(/\bSID\b/g, 'Sid');
    
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: fixedText,
        model_id: 'eleven_multilingual_v2',
      }),
    });
    
    if (!resp.ok) {
      console.error('TTS failed:', resp.status);
      return null;
    }
    
    return Buffer.from(await resp.arrayBuffer());
  } catch (e: any) {
    console.error('TTS error:', e.message);
    return null;
  }
}

// ============ TELEGRAM BOT ============
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function main() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Set SID_TELEGRAM_TOKEN env var');
    console.log('\nTo create SID\'s bot:');
    console.log('1. Message @BotFather on Telegram');
    console.log('2. /newbot');
    console.log('3. Name: Sid the Lobster');
    console.log('4. Username: sid_lobster_bot (or similar)');
    console.log('5. Copy the token');
    process.exit(1);
  }

  const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
  const bridge = new PumpChatBridge(bot);

  // Bot commands
  bot.command('start', (ctx) => {
    ctx.reply('🦞 Yo! Sid here. I\'m an AI lobster chilling on pump.fun.\n\nCommands:\n/watch <token> - Watch a token\'s chat\n/voice - Toggle voice responses\n/status - Check what I\'m watching');
  });

  bot.command('watch', async (ctx) => {
    const token = ctx.message.text.split(' ')[1];
    if (!token) {
      ctx.reply('Usage: /watch <token_address>');
      return;
    }
    
    bridge.stop();
    await bridge.startPolling(token);
    await bridge.connectTrades(token);
    
    ctx.reply(`👀 Now watching: ${token.slice(0, 8)}...`);
  });

  bot.command('status', (ctx) => {
    if (watchedToken) {
      ctx.reply(`👀 Watching: ${watchedToken.slice(0, 8)}...\n💬 Chat ID: ${ctx.chat.id}`);
    } else {
      ctx.reply('Not watching any token. Use /watch <address>');
    }
  });

  bot.command('chatid', (ctx) => {
    ctx.reply(`This chat ID: ${ctx.chat.id}`);
  });

  // Respond to messages (when in group or DM)
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    
    // Skip commands
    if (text.startsWith('/')) return;
    
    // Check if SID should respond
    const shouldRespond = 
      text.toLowerCase().includes('sid') ||
      ctx.chat.type === 'private' ||
      Math.random() < 0.1; // 10% random chance in groups
    
    if (!shouldRespond) return;
    
    const response = await generateSidResponse(text);
    if (!response) return;
    
    // Send text response
    await ctx.reply(response);
    
    // Send voice (optional)
    const audio = await textToSpeech(response);
    if (audio) {
      await ctx.replyWithVoice({ source: audio });
    }
  });

  // Launch bot
  bot.launch();
  console.log('🦞 Sid bot is live!');
  
  // Graceful shutdown
  process.once('SIGINT', () => {
    bridge.stop();
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    bridge.stop();
    bot.stop('SIGTERM');
  });
}

main().catch(console.error);
