# SID - AI Trading Streamer

Autonomous AI streamer with voice, 3D avatar, and real personality. Powered by OpenClaw.

## Features

- 🤖 **AI Brain** - Claude-powered responses or fallback mode
- 🎤 **Voice** - ElevenLabs text-to-speech
- 👤 **3D Avatar** - WebGL animated character with emotions
- 📊 **Live Dashboard** - Control panel for the AI
- 📈 **Market Data** - Real-time crypto price feeds
- 💬 **Chat Integration** - Reads pump.fun chat and responds

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
export ELEVENLABS_API_KEY=your_key

# Run Sid
npx tsx sid-openclaw.ts
```

Open `http://localhost:3456` for the dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         SID                             │
├─────────────────────────────────────────────────────────┤
│  BRAIN (Claude/Fallback)                                │
│  ├── Personality engine                                 │
│  ├── Market analysis                                    │
│  └── Response generation                                │
├─────────────────────────────────────────────────────────┤
│  VOICE (ElevenLabs)                                     │
│  └── Text-to-speech with emotion                        │
├─────────────────────────────────────────────────────────┤
│  AVATAR (WebGL)                                         │
│  ├── 3D character with expressions                      │
│  └── Lip sync animations                                │
├─────────────────────────────────────────────────────────┤
│  DASHBOARD (Web UI)                                     │
│  ├── Voice controls                                     │
│  ├── Market data                                        │
│  └── Trade buttons                                      │
└─────────────────────────────────────────────────────────┘
```

## Endpoints

- `GET /` - Dashboard UI
- `GET /avatar` - OBS overlay (transparent background)
- `GET /events` - SSE stream for real-time updates
- `POST /speak` - Make Sid say something
- `GET /status` - Current state

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ELEVENLABS_API_KEY` | ElevenLabs API key for voice |
| `SID_AUTH` | Auth token for API access (default: sid2026) |

## License

MIT
