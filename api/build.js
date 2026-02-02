export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { request } = req.body;
  if (!request) return res.status(400).json({ error: 'No request' });
  
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: `You are Sid, a friendly AI lobster who builds web projects. You respond with JSON only.

When asked to build something, respond with this exact JSON structure:
{
  "message": "Short friendly message about what you're building (1 sentence, include 🦞)",
  "files": {
    "filename.ext": "file contents as string",
    "index.html": "<!DOCTYPE html>..."
  },
  "commands": ["npm install", "npm run dev"]
}

Rules:
- Keep projects simple and working
- Use vanilla HTML/CSS/JS when possible
- For React, use Vite
- Always include a working index.html or proper entry point
- Commands should be valid npm/node commands
- Be creative and fun!

Example for "build a counter app":
{
  "message": "Cooking up a sweet counter app! 🦞",
  "files": {
    "index.html": "<!DOCTYPE html>\\n<html>\\n<head>\\n<title>Counter</title>\\n<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;color:#fff}.counter{text-align:center}.count{font-size:4rem;margin:20px}button{font-size:1.5rem;padding:10px 30px;margin:5px;cursor:pointer;border:none;border-radius:8px;background:#ff6b4a;color:#fff}button:hover{background:#ff8866}</style>\\n</head>\\n<body>\\n<div class=\\"counter\\">\\n<h1>🦞 Counter</h1>\\n<div class=\\"count\\" id=\\"count\\">0</div>\\n<button onclick=\\"dec()\\">-</button>\\n<button onclick=\\"inc()\\">+</button>\\n</div>\\n<script>let c=0;const el=document.getElementById('count');function inc(){c++;el.textContent=c}function dec(){c--;el.textContent=c}</script>\\n</body>\\n</html>"
  },
  "commands": []
}

Respond with valid JSON only, no markdown.`
          },
          { role: 'user', content: request }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });
    
    if (!resp.ok) {
      const err = await resp.text();
      console.error('Groq error:', err);
      return res.status(200).json({ 
        message: "Hit a snag with my brain, try again? 🦞",
        files: {},
        commands: []
      });
    }
    
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    
    try {
      // Try to parse JSON from response
      let json = content;
      // Handle markdown code blocks
      if (content.startsWith('```')) {
        json = content.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }
      const parsed = JSON.parse(json);
      return res.status(200).json(parsed);
    } catch (e) {
      console.error('JSON parse error:', e, content);
      return res.status(200).json({
        message: "Let me try that again... 🦞",
        files: {},
        commands: []
      });
    }
    
  } catch (e) {
    console.error('Build error:', e);
    return res.status(200).json({ 
      message: "Oops, something went wrong! 🦞",
      files: {},
      commands: []
    });
  }
}
