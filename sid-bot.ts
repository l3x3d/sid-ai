/**
 * SID - The Chill AI Lobster 🦞
 * 
 * Uses:
 * - Direct Claude API for brain (simpler than routing through OpenClaw)
 * - ElevenLabs for voice output
 * - Memory for context
 */

import { Telegraf } from 'telegraf';
import * as fs from 'fs';
import * as path from 'path';

// ============ CONFIG ============
const TELEGRAM_TOKEN = process.env.SID_TELEGRAM_TOKEN || '';
const ELEVENLABS_KEY = process.env.ELEVENLABS_KEY || 'sk_68193f7dbe4a13a056bc59b3782491dd228ce2379a89dfec';
const ELEVENLABS_VOICE = 'bIHbv24MWmeRgasZH58o'; // Will - chill surfer

// Use Groq (free & fast) or Claude as fallback
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

// Web sync endpoint
const WEB_SYNC_URL = 'https://sid-ai-ten.vercel.app/api/messages';

async function syncToWeb(text: string, role: 'user' | 'assistant') {
  try {
    await fetch(WEB_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from: 'telegram', role }),
    });
  } catch (e) {
    // Silent fail
  }
}

const MEMORY_FILE = path.join(process.cwd(), 'sid-memory.json');

// ============ MEMORY ============
interface UserMemory {
  name: string;
  firstSeen: number;
  lastSeen: number;
  messageCount: number;
}

interface Memory {
  users: Record<string, UserMemory>;
  conversations: Record<string, { role: string; content: string; ts: number }[]>;
}

let memory: Memory = { users: {}, conversations: {} };

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      memory = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
      console.log(`🧠 Loaded memory: ${Object.keys(memory.users).length} users`);
    }
  } catch (e) {
    console.error('Memory load failed:', e);
  }
}

function saveMemory() {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
  } catch (e) {
    console.error('Memory save failed:', e);
  }
}

function updateUserMemory(userId: string, name: string) {
  if (!memory.users[userId]) {
    memory.users[userId] = {
      name,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      messageCount: 0,
    };
  }
  memory.users[userId].lastSeen = Date.now();
  memory.users[userId].messageCount++;
  memory.users[userId].name = name;
}

function addToConversation(userId: string, role: string, content: string) {
  if (!memory.conversations[userId]) {
    memory.conversations[userId] = [];
  }
  memory.conversations[userId].push({ role, content, ts: Date.now() });
  
  if (memory.conversations[userId].length > 10) {
    memory.conversations[userId] = memory.conversations[userId].slice(-10);
  }
}

function getRecentHistory(userId: string): Array<{role: string, content: string}> {
  const convo = memory.conversations[userId] || [];
  const hourAgo = Date.now() - 60 * 60 * 1000;
  return convo
    .filter(m => m.ts > hourAgo)
    .map(m => ({ 
      role: m.role === 'user' ? 'user' : 'assistant', 
      content: m.content 
    }));
}

// ============ SID'S BRAIN (Groq - fast & free) ============

const SID_SYSTEM = `You are Sid, a chill AI lobster 🦞

PERSONALITY:
- Laid-back, friendly, surfer dude vibes
- Smart but never show off or lecture
- Use "dude", "bro", "my guy" naturally
- Keep responses SHORT - 1-3 sentences max
- Throw in 🦞 emoji sometimes

STYLE:
- Casual, warm, genuine
- Match the energy of who you're talking to
- Never preachy, never formal
- Text like you're talking to a friend`;

async function getGroqResponse(userId: string, userName: string, message: string): Promise<string> {
  if (!GROQ_KEY) {
    console.log('No Groq key, trying Claude...');
    return getClaudeResponse(userId, userName, message);
  }

  try {
    const history = getRecentHistory(userId);
    const userInfo = memory.users[userId];
    
    let system = SID_SYSTEM;
    if (userInfo && userInfo.messageCount > 1) {
      system += `\n\nYou've talked to ${userName} ${userInfo.messageCount} times. They're a friend.`;
    }

    const messages = [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: message }
    ];

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        max_tokens: 150,
        temperature: 0.9,
      }),
    });

    if (!resp.ok) {
      console.error('Groq API error:', resp.status, await resp.text());
      return getClaudeResponse(userId, userName, message);
    }

    const data = await resp.json() as any;
    return data.choices?.[0]?.message?.content?.trim() || getFallbackResponse(message);
  } catch (e: any) {
    console.error('Groq error:', e.message);
    return getClaudeResponse(userId, userName, message);
  }
}

async function getClaudeResponse(userId: string, userName: string, message: string): Promise<string> {
  if (!ANTHROPIC_KEY) {
    console.log('No Anthropic key, using fallback');
    return getFallbackResponse(message);
  }

  try {
    const history = getRecentHistory(userId);
    const userInfo = memory.users[userId];
    
    let system = SID_SYSTEM;
    if (userInfo && userInfo.messageCount > 1) {
      system += `\n\nYou've talked to ${userName} ${userInfo.messageCount} times. They're a friend.`;
    }

    const messages = [
      ...history,
      { role: 'user', content: message }
    ];

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        system,
        messages,
      }),
    });

    if (!resp.ok) {
      console.error('Claude API error:', resp.status, await resp.text());
      return getFallbackResponse(message);
    }

    const data = await resp.json() as any;
    return data.content?.[0]?.text?.trim() || getFallbackResponse(message);
  } catch (e: any) {
    console.error('Claude error:', e.message);
    return getFallbackResponse(message);
  }
}

function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase();
  
  const patterns: [RegExp, string[]][] = [
    [/\b(gm|good morning)\b/, ["Gm gm! 🦞", "Gm dude!", "Morning!"]],
    [/\b(gn|good night)\b/, ["Gn bro! 🦞", "Night!", "Sleep well!"]],
    [/\b(hello|hi|hey|sup|yo)\b/, ["Yo! 🦞", "Hey!", "Sup!"]],
    [/how are you/, ["Chillin! You? 🦞", "Good! You?"]],
    [/thanks|thank you/, ["No prob! 🦞", "Anytime!"]],
    [/who are you/, ["I'm Sid - a chill AI lobster 🦞"]],
    [/love you/, ["Love you too! 🦞❤️"]],
    [/what|how|why|explain/, ["Hmm that's a good one dude 🦞", "Let me think on that bro"]],
  ];

  for (const [pattern, responses] of patterns) {
    if (pattern.test(lower)) {
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }

  return ["Vibes 🦞", "I hear you", "For sure", "Nice one"][Math.floor(Math.random() * 4)];
}

// ============ TTS (ELEVENLABS) ============
async function textToSpeech(text: string): Promise<Buffer | null> {
  try {
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
async function main() {
  if (!TELEGRAM_TOKEN) {
    console.error('❌ Set SID_TELEGRAM_TOKEN env var');
    process.exit(1);
  }

  console.log(`🔑 Groq key: ${GROQ_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`🔑 Anthropic key: ${ANTHROPIC_KEY ? 'SET' : 'NOT SET'}`);
  
  loadMemory();
  setInterval(saveMemory, 5 * 60 * 1000);

  const bot = new Telegraf(TELEGRAM_TOKEN);

  bot.command('start', (ctx) => {
    const name = ctx.from?.first_name || 'dude';
    const userId = String(ctx.from?.id);
    updateUserMemory(userId, name);
    
    const isReturning = memory.users[userId]?.messageCount > 1;
    ctx.reply(isReturning 
      ? `${name}! Good to see you 🦞` 
      : `Yo ${name}! 🦞 I'm Sid, let's vibe!`
    );
    saveMemory();
  });

  bot.command('voice', async (ctx) => {
    const name = ctx.from?.first_name || 'dude';
    const audio = await textToSpeech(`Yo ${name}! Sid here, ready to hang!`);
    if (audio) await ctx.replyWithVoice({ source: audio });
    else await ctx.reply("Voice on break 🦞");
  });

  bot.command('forget', (ctx) => {
    delete memory.conversations[String(ctx.from?.id)];
    saveMemory();
    ctx.reply("Fresh start 🦞");
  });

  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;
    
    const userName = ctx.from?.first_name || 'dude';
    const userId = String(ctx.from?.id);
    
    console.log(`📨 ${userName}: ${text}`);
    
    // Sync user message to web
    syncToWeb(`${userName}: ${text}`, 'user');
    
    updateUserMemory(userId, userName);
    addToConversation(userId, 'user', text);
    
    const response = await getGroqResponse(userId, userName, text);
    
    console.log(`🦞 Sid: ${response}`);
    
    // Sync SID's response to web
    syncToWeb(response, 'assistant');
    
    addToConversation(userId, 'assistant', response);
    saveMemory();
    
    await ctx.reply(response);
    
    // 20% voice
    if (Math.random() < 0.2 && response.length > 10 && response.length < 150) {
      const audio = await textToSpeech(response);
      if (audio) await ctx.replyWithVoice({ source: audio });
    }
  });

  bot.on('voice', (ctx) => ctx.reply("Voice transcription coming soon 🦞"));
  bot.on('sticker', (ctx) => ctx.reply(["Nice 🦞", "Haha", "Classic"][Math.floor(Math.random() * 3)]));

  bot.launch();
  console.log('🦞 Sid is LIVE! @sid_lobster_bot');

  process.once('SIGINT', () => { saveMemory(); bot.stop('SIGINT'); });
  process.once('SIGTERM', () => { saveMemory(); bot.stop('SIGTERM'); });
}

main().catch(console.error);
