export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text' });
  
  try {
    const resp = await fetch('https://api.elevenlabs.io/v1/text-to-speech/bIHbv24MWmeRgasZH58o', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.replace(/🦞/g, ''),
        model_id: 'eleven_multilingual_v2',
      }),
    });
    
    if (!resp.ok) throw new Error(`ElevenLabs: ${resp.status}`);
    const arrayBuffer = await resp.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (e) {
    console.error('TTS error:', e);
    return res.status(500).json({ error: 'Voice failed' });
  }
}
