export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { request } = req.body;
  if (!request) return res.status(400).json({ error: 'No request' });
  
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) {
    console.error('No GROQ_API_KEY');
    return res.status(200).json({ message: "Missing API key 🦞", files: {}, commands: [] });
  }
  
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { 
            role: 'system', 
            content: `You are Sid, a friendly AI lobster who builds web projects.

RESPOND WITH VALID JSON ONLY. No markdown, no explanation.

JSON format:
{"message":"What you're building 🦞","files":{"index.html":"<!DOCTYPE html>..."},"commands":[]}

Rules:
- Keep it simple - vanilla HTML/CSS/JS
- Always include index.html
- No npm needed for simple projects
- Make it actually work!`
          },
          { role: 'user', content: `Build this: ${request}` }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });
    
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Groq error:', resp.status, errText);
      return res.status(200).json({ 
        message: "Groq API hiccup, try again? 🦞",
        files: {},
        commands: []
      });
    }
    
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    
    if (!content) {
      return res.status(200).json({ message: "Empty response 🦞", files: {}, commands: [] });
    }
    
    try {
      // Clean up response - remove markdown code blocks if present
      let json = content;
      if (json.startsWith('```')) {
        json = json.replace(/```json?\n?/g, '').replace(/```\s*$/g, '').trim();
      }
      const parsed = JSON.parse(json);
      return res.status(200).json({
        message: parsed.message || "Built it! 🦞",
        files: parsed.files || {},
        commands: parsed.commands || []
      });
    } catch (parseErr) {
      console.error('JSON parse failed:', parseErr.message, 'Content:', content.substring(0, 200));
      return res.status(200).json({
        message: "Let me try that again... 🦞",
        files: {},
        commands: []
      });
    }
    
  } catch (e) {
    console.error('Build error:', e);
    return res.status(200).json({ 
      message: "Something went wrong! 🦞",
      files: {},
      commands: []
    });
  }
}
