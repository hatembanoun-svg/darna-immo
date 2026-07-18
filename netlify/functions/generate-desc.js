
// netlify/functions/generate-desc.js
// ضع هذا الملف في: netlify/functions/generate-desc.js في مشروع GitHub

export async function handler(event) {
  // السماح فقط بـ POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // CORS headers للسماح للموقع بالاستدعاء
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const { prompt } = JSON.parse(event.body);
    if (!prompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'prompt missing' }) };
    }

    // الـ API key محفوظ في Netlify Environment Variables — لا يظهر للزوار أبداً
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // أسرع وأرخص لتوليد النصوص القصيرة
        max_tokens: 350,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Anthropic error:', err);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'API error' }) };
    }

    const data = await res.json();
    const text = data.content?.map(b => b.text || '').join('').trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text })
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
}
