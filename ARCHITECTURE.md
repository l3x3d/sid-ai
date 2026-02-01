# SID - Autonomous AI Streamer

Not a Phil clone. Sid is his own agent with real personality, voice, and 3D presence.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         SID                                  │
├─────────────────────────────────────────────────────────────┤
│  BRAIN (Claude)                                              │
│  ├── Personality engine                                      │
│  ├── Market analysis                                         │
│  ├── Chat response generation                                │
│  └── Autonomous decision making                              │
├─────────────────────────────────────────────────────────────┤
│  VOICE (ElevenLabs)                                          │
│  ├── Text-to-speech                                          │
│  ├── Emotion control                                         │
│  └── Real-time streaming                                     │
├─────────────────────────────────────────────────────────────┤
│  AVATAR (3D WebGL)                                           │
│  ├── VRM/Ready Player Me model                               │
│  ├── Lip sync (visemes)                                      │
│  ├── Idle animations                                         │
│  └── Emotion expressions                                     │
├─────────────────────────────────────────────────────────────┤
│  INPUTS                                                      │
│  ├── Pump.fun chat/trades                                    │
│  ├── DexScreener market data                                 │
│  ├── Twitter mentions                                        │
│  └── Telegram commands                                       │
├─────────────────────────────────────────────────────────────┤
│  OUTPUTS                                                     │
│  ├── OBS virtual camera/audio                                │
│  ├── YouTube/Twitch stream                                   │
│  └── Telegram alerts                                         │
└─────────────────────────────────────────────────────────────┘
```

## Sid's Personality

NOT a Phil clone. Sid is:
- Sharp, analytical, slightly cynical
- Calls out rugs and scams aggressively  
- Celebrates wins but stays grounded
- Has opinions and isn't afraid to share them
- Funny but not try-hard
- Speaks like a real trader, not a bot

## Voice

ElevenLabs voice ID: TBD (custom or select from library)
Style: Confident, slightly gravelly, energetic

## Avatar

3D character rendered in browser:
- Style: Cyberpunk/futuristic
- Expressions: Neutral, excited, skeptical, laughing
- Idle animations: Subtle movement, blinking
- Reaction animations: Pump (excited), dump (facepalm)

## Files

- `sid-brain.ts` - Claude-powered decision engine
- `sid-voice.ts` - ElevenLabs TTS with emotion
- `sid-avatar/` - 3D avatar web app
- `sid-stream.ts` - OBS integration
- `sid.ts` - Main orchestrator

## Setup

1. Get ElevenLabs API key
2. Create/download VRM avatar
3. Configure OBS browser source
4. Run `npx tsx sid.ts`
