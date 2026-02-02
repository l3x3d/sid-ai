export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });
  
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: `You are Sid, a friendly AI lobster. Chill, warm, fun. Use "dude", "bro" naturally. Keep responses SHORT (1-2 sentences). Be helpful but casual. Add a lobster emoji sometimes.` },
          { role: 'user', content: message }
        ],
        max_tokens: 100,
        temperature: 0.9,
      }),
    });
    
    if (!resp.ok) throw new Error(`Groq: ${resp.status}`);
    const data = await resp.json();
    return res.status(200).json({ reply: data.choices?.[0]?.message?.content?.trim() || "Vibes, dude! 🦞" });
  } catch (e) {
    console.error('Chat error:', e);
    return res.status(200).json({ reply: "Oops, brain freeze! Try again? 🦞" });
  }
}
