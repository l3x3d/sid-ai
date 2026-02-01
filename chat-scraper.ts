/**
 * Pump.fun Chat Scraper
 * Connects to pump.fun and reads live chat messages
 */

import WebSocket from 'ws';

export interface ChatMessage {
  user: string;
  text: string;
  timestamp: number;
  mint?: string;
}

export class PumpChatScraper {
  private ws: WebSocket | null = null;
  private tokenAddress: string;
  private onMessage: (msg: ChatMessage) => void;
  private reconnectAttempts = 0;
  private maxReconnects = 5;

  constructor(tokenAddress: string, onMessage: (msg: ChatMessage) => void) {
    this.tokenAddress = tokenAddress;
    this.onMessage = onMessage;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Pump.fun uses a websocket for real-time updates
        const wsUrl = `wss://pumpportal.fun/api/data`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          console.log('🔌 Connected to pump.fun websocket');
          
          // Subscribe to token trades/chat
          const subscribeMsg = {
            method: 'subscribeTokenTrade',
            keys: [this.tokenAddress]
          };
          this.ws?.send(JSON.stringify(subscribeMsg));
          
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString());
            
            // Handle different message types
            if (msg.txType === 'buy' || msg.txType === 'sell') {
              // Trade message - we can announce these
              const chatMsg: ChatMessage = {
                user: msg.traderPublicKey?.slice(0, 8) || 'anon',
                text: `${msg.txType === 'buy' ? '🟢 BUY' : '🔴 SELL'} ${(msg.solAmount || 0).toFixed(3)} SOL`,
                timestamp: Date.now(),
                mint: msg.mint
              };
              this.onMessage(chatMsg);
            }
          } catch (e) {
            // Not JSON or parse error - ignore
          }
        });

        this.ws.on('error', (err) => {
          console.error('❌ WebSocket error:', err.message);
        });

        this.ws.on('close', () => {
          console.log('🔌 WebSocket closed');
          this.tryReconnect();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private async tryReconnect() {
    if (this.reconnectAttempts < this.maxReconnects) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts})`);
      await new Promise(r => setTimeout(r, 2000 * this.reconnectAttempts));
      this.connect().catch(console.error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Alternative: Poll pump.fun API for chat messages
export async function fetchPumpChat(tokenAddress: string): Promise<ChatMessage[]> {
  try {
    // Pump.fun chat endpoint
    const resp = await fetch(`https://frontend-api.pump.fun/replies/${tokenAddress}?limit=50`);
    if (!resp.ok) return [];
    
    const data = await resp.json() as any[];
    
    return data.map(msg => ({
      user: msg.user?.username || msg.user?.wallet?.slice(0, 8) || 'anon',
      text: msg.text || '',
      timestamp: new Date(msg.created_at || msg.timestamp).getTime(),
      mint: tokenAddress
    }));
  } catch (e) {
    console.error('Failed to fetch chat:', e);
    return [];
  }
}

// Test
if (require.main === module) {
  const testToken = process.argv[2] || 'DapsZMWnySYgexnmF75yq4XKaH8RBF2YeWtRvtD8pump';
  
  console.log(`\n🔍 Testing chat scraper for ${testToken}\n`);
  
  // Test polling method
  fetchPumpChat(testToken).then(messages => {
    console.log(`📝 Found ${messages.length} chat messages:\n`);
    messages.slice(0, 10).forEach(m => {
      console.log(`  [${m.user}]: ${m.text.slice(0, 50)}`);
    });
  });
  
  // Test websocket
  const scraper = new PumpChatScraper(testToken, (msg) => {
    console.log(`\n💬 LIVE: [${msg.user}] ${msg.text}`);
  });
  
  scraper.connect().then(() => {
    console.log('\n👂 Listening for live trades...\n');
  }).catch(console.error);
}
