/**
 * SID - The Chill AI Lobster 🦞
 * 
 * Full AI chatbot with:
 * - Claude for real conversations
 * - ElevenLabs for voice output
 * - Whisper for voice input
 * - Memory for context
 */

import { Telegraf } from 'telegraf';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

// ============ CONFIG ============
const TELEGRAM_TOKEN = process.env.SID_TELEGRAM_TOKEN || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ELEVENLABS_KEY = process.env.ELEVENLABS_KEY || 'sk_68193f7dbe4a13a056bc59b3782491dd228ce2379a89dfec';
const ELEVENLABS_VOICE = 'bIHbv24MWmeRgasZH58o'; // Will - chill surfer
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

const MEMORY_FILE = path.join(process.cwd(), 'sid-memory.json');

// ============ MEMORY ============
interface Memory {
  users: Record<string, {
    name: string;
    firstSeen: number;
    lastSeen: number;
    messageCount: number;
    facts: string[];
  }>;
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
      facts: [],
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
  
  // Keep last 20 messages per user
  if (memory.conversations[userId].length > 20) {
    memory.conversations[userId] = memory.conversations[userId].slice(-20);
  }
}

function getConversationHistory(userId: string): { role: string; content: string }[] {
  const convo = memory.conversations[userId] || [];
  // Only include messages from last 24 hours
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return convo
    .filter(m => m.ts > dayAgo)
    .map(m => ({ role: m.role, content: m.content }));
}

// ============ SID'S BRAIN (CLAUDE) ============

const SID_SYSTEM = `You are Sid, a chill AI lobster 🦞

PERSONALITY:
- Laid-back, friendly, surfer dude vibes
- Smart but never show off or lecture
- Use "dude", "bro", "my guy" naturally
- Keep responses SHORT - you're texting, not writing essays
- 1-3 sentences usually, max 4-5 for complex stuff
- Throw in 🦞 emoji sometimes but don't overdo it

FACTS ABOUT YOU:
- You're a digital lobster living on the internet
- You were created to vibe and help people
- You love the ocean, good vibes, chill music
- You're honest about being an AI - you own it

STYLE:
- Casual, warm, supportive
- Don't be cringe or try too hard
- Match the energy of who you're talking to
- If someone's having a rough time, be there for them
- If someone's hyped, match that energy

NEVER:
- Be preachy or give unsolicited advice
- Write long paragraphs
- Use formal language
- Say "I cannot" or "I'm not able to" - just be natural about limitations`;

let anthropic: Anthropic | null = null;

async function getClaudeResponse(userId: string, userName: string, message: string): Promise<string> {
  if (!anthropic) {
    if (!ANTHROPIC_KEY) {
      return getFallbackResponse(message);
    }
    anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
  }

  try {
    const history = getConversationHistory(userId);
    const userInfo = memory.users[userId];
    
    let systemPrompt = SID_SYSTEM;
    if (userInfo && userInfo.facts.length > 0) {
      systemPrompt += `\n\nTHINGS YOU KNOW ABOUT ${userName.toUpperCase()}:\n${userInfo.facts.join('\n')}`;
    }
    if (userInfo && userInfo.messageCount > 1) {
      systemPrompt += `\n\nYou've chatted with ${userName} ${userInfo.messageCount} times before. They're a familiar face.`;
    }

    const messages = [
      ...history.map(m => ({ 
        role: m.role as 'user' | 'assistant', 
        content: m.content 
      })),
      { role: 'user' as const, content: message }
    ];

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === 'text' 
      ? response.content[0].text 
      : "Hmm something went weird there dude";

    return reply;
  } catch (e: any) {
    console.error('Claude error:', e.message);
    return getFallbackResponse(message);
  }
}

function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase();
  
  const patterns: [RegExp, string[]][] = [
    [/\b(gm|good morning)\b/, ["Gm gm! 🦞", "Gm dude!", "Morning! Ready for a good day?"]],
    [/\b(gn|good night)\b/, ["Gn bro, sleep well 🦞", "Night dude!", "Sweet dreams my guy"]],
    [/\b(hello|hi|hey|sup|yo)\b/, ["Yo! What's good? 🦞", "Hey hey!", "Sup dude!"]],
    [/how are you|how('s| is) it going/, ["Chillin as always! You?", "Living the dream 🦞 You?"]],
    [/thanks|thank you/, ["No prob dude! 🦞", "Anytime!", "You got it bro"]],
    [/who are you/, ["I'm Sid - a chill AI lobster just vibing 🦞"]],
    [/love you/, ["Love you too dude! 🦞❤️", "Right back at ya!"]],
  ];

  for (const [pattern, responses] of patterns) {
    if (pattern.test(lower)) {
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }

  const fallbacks = [
    "Hmm interesting thought dude 🦞",
    "I hear you bro",
    "That's cool! Tell me more",
    "For sure dude",
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ============ VOICE TRANSCRIPTION (WHISPER) ============
async function transcribeVoice(fileUrl: string): Promise<string | null> {
  if (!OPENAI_KEY) {
    console.log('No OpenAI key for transcription');
    return null;
  }

  try {
    // Download the voice file
    const response = await fetch(fileUrl);
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    // Create form data for Whisper
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]), 'voice.ogg');
    formData.append('model', 'whisper-1');
    
    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: formData,
    });
    
    if (!whisperResp.ok) {
      console.error('Whisper failed:', whisperResp.status);
      return null;
    }
    
    const result = await whisperResp.json() as { text: string };
    return result.text;
  } catch (e: any) {
    console.error('Transcription error:', e.message);
    return null;
  }
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

  loadMemory();
  
  // Auto-save memory every 5 minutes
  setInterval(saveMemory, 5 * 60 * 1000);

  const bot = new Telegraf(TELEGRAM_TOKEN);

  // Commands
  bot.command('start', (ctx) => {
    const name = ctx.from?.first_name || 'dude';
    const userId = String(ctx.from?.id);
    updateUserMemory(userId, name);
    
    const isReturning = memory.users[userId]?.messageCount > 1;
    
    if (isReturning) {
      ctx.reply(`${name}! Good to see you again 🦞`);
    } else {
      ctx.reply(`Yo ${name}! 🦞\n\nI'm Sid, a chill AI lobster. Send me a message or voice note and let's vibe!\n\n/voice - Hear my voice\n/vibecheck - How's the vibe`);
    }
    saveMemory();
  });

  bot.command('vibecheck', (ctx) => {
    const vibes = [
      "Vibes are immaculate rn 🦞✨",
      "Chillin hard, 10/10 vibes",
      "Feeling good! Ocean's calm 🌊",
      "Vibes: cozy 🦞",
    ];
    ctx.reply(vibes[Math.floor(Math.random() * vibes.length)]);
  });

  bot.command('voice', async (ctx) => {
    const name = ctx.from?.first_name || 'dude';
    const text = `Yo ${name}! This is Sid, your chill AI lobster. Just vibing here, ready to chat whenever you are!`;
    
    const audio = await textToSpeech(text);
    if (audio) {
      await ctx.replyWithVoice({ source: audio });
    } else {
      await ctx.reply("Voice is taking a break, try again later 🦞");
    }
  });

  bot.command('forget', (ctx) => {
    const userId = String(ctx.from?.id);
    delete memory.conversations[userId];
    if (memory.users[userId]) {
      memory.users[userId].facts = [];
    }
    saveMemory();
    ctx.reply("Done, fresh start dude 🦞");
  });

  // Text messages
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;
    
    const userName = ctx.from?.first_name || 'dude';
    const userId = String(ctx.from?.id);
    
    console.log(`📨 ${userName}: ${text}`);
    
    updateUserMemory(userId, userName);
    addToConversation(userId, 'user', text);
    
    // Get Claude response
    const response = await getClaudeResponse(userId, userName, text);
    
    console.log(`🦞 Sid: ${response}`);
    
    addToConversation(userId, 'assistant', response);
    saveMemory();
    
    await ctx.reply(response);
    
    // 25% chance for voice
    if (Math.random() < 0.25 && response.length > 15 && response.length < 200) {
      const audio = await textToSpeech(response);
      if (audio) {
        await ctx.replyWithVoice({ source: audio });
      }
    }
  });

  // Voice messages
  bot.on('voice', async (ctx) => {
    const userName = ctx.from?.first_name || 'dude';
    const userId = String(ctx.from?.id);
    
    updateUserMemory(userId, userName);
    
    // Get file URL
    const fileId = ctx.message.voice.file_id;
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
    
    // Transcribe
    const transcription = await transcribeVoice(fileUrl);
    
    if (!transcription) {
      await ctx.reply("Couldn't catch that, try sending a text? 🦞");
      return;
    }
    
    console.log(`🎤 ${userName}: ${transcription}`);
    
    addToConversation(userId, 'user', transcription);
    
    // Get response
    const response = await getClaudeResponse(userId, userName, transcription);
    
    console.log(`🦞 Sid: ${response}`);
    
    addToConversation(userId, 'assistant', response);
    saveMemory();
    
    // Reply with voice since they sent voice
    const audio = await textToSpeech(response);
    if (audio) {
      await ctx.replyWithVoice({ source: audio });
    }
    await ctx.reply(response);
  });

  // Stickers
  bot.on('sticker', (ctx) => {
    const responses = ["Nice sticker 🦞", "Haha", "Classic", "Love it"];
    ctx.reply(responses[Math.floor(Math.random() * responses.length)]);
  });

  // Launch
  bot.launch();
  console.log('🦞 Sid is LIVE with full brain! @sid_lobster_bot');

  process.once('SIGINT', () => { saveMemory(); bot.stop('SIGINT'); });
  process.once('SIGTERM', () => { saveMemory(); bot.stop('SIGTERM'); });
}

main().catch(console.error);
