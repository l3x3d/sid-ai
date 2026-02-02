// In-memory message store (syncs between Telegram and Web)
// For production, use Redis or a database

const messages = [];
const MAX_MESSAGES = 100;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // GET - poll for messages
  if (req.method === 'GET') {
    const since = req.query.since;
    let filtered = messages;
    
    if (since) {
      const idx = messages.findIndex(m => m.id === since);
      if (idx !== -1) {
        filtered = messages.slice(idx + 1);
      }
    }
    
    return res.status(200).json({ messages: filtered.slice(-20) });
  }
  
  // POST - add a message (from Telegram webhook or web)
  if (req.method === 'POST') {
    const { text, from, role } = req.body;
    
    if (!text) return res.status(400).json({ error: 'No text' });
    
    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      text,
      from: from || 'web',
      role: role || 'user',
      timestamp: Date.now()
    };
    
    messages.push(msg);
    
    // Keep only last N messages
    while (messages.length > MAX_MESSAGES) {
      messages.shift();
    }
    
    return res.status(200).json({ success: true, message: msg });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
