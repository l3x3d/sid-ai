/**
 * Sid Voice - ElevenLabs TTS Integration
 * Converts text to speech for livestream
 */

import * as fs from 'fs';
import * as path from 'path';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

// Voice IDs from ElevenLabs (you can change these)
const VOICE_OPTIONS = {
  // Free voices
  'adam': '21m00Tcm4TlvDq8ikWAM',      // Deep male
  'antoni': 'ErXwobaYiN019PkySvjV',     // Warm male
  'josh': 'TxGEqnHWrfWFTfGW9XjX',       // Young male
  'arnold': 'VR6AewLTigWG4xSOukaG',     // Strong male
  'sam': 'yoZ06aMxZJJ28mfd3POQ',        // Narrative male
  // Good for Sid vibe:
  'default': 'TxGEqnHWrfWFTfGW9XjX'     // Josh - energetic young male
};

export interface VoiceConfig {
  voiceId: string;
  stability: number;       // 0-1, lower = more expressive
  similarityBoost: number; // 0-1, higher = more consistent
  speed: number;           // 0.5-2.0
}

const defaultConfig: VoiceConfig = {
  voiceId: VOICE_OPTIONS.default,
  stability: 0.4,          // Expressive for entertainment
  similarityBoost: 0.7,
  speed: 1.1               // Slightly fast for energy
};

export async function textToSpeech(
  text: string, 
  outputPath: string,
  config: Partial<VoiceConfig> = {}
): Promise<string | null> {
  const cfg = { ...defaultConfig, ...config };
  
  if (!ELEVENLABS_API_KEY) {
    console.error('❌ ELEVENLABS_API_KEY not set');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: cfg.stability,
            similarity_boost: cfg.similarityBoost
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ ElevenLabs error:', error);
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(audioBuffer));
    
    return outputPath;
  } catch (error) {
    console.error('❌ TTS error:', error);
    return null;
  }
}

// Stream audio directly (for real-time)
export async function textToSpeechStream(
  text: string,
  config: Partial<VoiceConfig> = {}
): Promise<Buffer | null> {
  const cfg = { ...defaultConfig, ...config };
  
  if (!ELEVENLABS_API_KEY) {
    console.error('❌ ELEVENLABS_API_KEY not set');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: cfg.stability,
            similarity_boost: cfg.similarityBoost
          }
        })
      }
    );

    if (!response.ok) {
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    return Buffer.from(audioBuffer);
  } catch (error) {
    console.error('❌ TTS stream error:', error);
    return null;
  }
}

// Test
if (require.main === module) {
  const testText = "What's up degens! Sid here, watching the charts and the chaos. Let's see what pump fun is cooking today.";
  
  console.log('\n🎤 Testing Sid Voice\n');
  console.log(`Text: "${testText}"\n`);
  
  if (!ELEVENLABS_API_KEY) {
    console.log('⚠️  Set ELEVENLABS_API_KEY to test TTS');
    console.log('   Get a free key at: https://elevenlabs.io');
    console.log('\n   export ELEVENLABS_API_KEY=your_key_here');
  } else {
    const outputPath = path.join(__dirname, 'test-voice.mp3');
    textToSpeech(testText, outputPath).then(result => {
      if (result) {
        console.log(`✅ Audio saved to: ${result}`);
        console.log('   Play with: mpv test-voice.mp3');
      }
    });
  }
}
