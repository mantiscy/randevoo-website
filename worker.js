export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      return new Response(`Worker error: ${err.message}\n${err.stack}`, { status: 500 });
    }
  },
};

async function handle(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/api/beta-signup' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const { email, device } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Invalid email' }, 400);
    }

    if (!['ios', 'android'].includes(device)) {
      return json({ error: 'Invalid device' }, 400);
    }

    const supabaseRes = await fetch(`${env.SUPABASE_URL}/rest/v1/beta_users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=ignore-duplicates',
      },
      body: JSON.stringify({ email, device_type: device }),
    });

    if (!supabaseRes.ok && supabaseRes.status !== 409) {
      const errText = await supabaseRes.text();
      console.error('Supabase error:', errText);
      return json({ error: 'Database error' }, 500);
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Randevoo <no-reply@randevoo.io>',
        to: ['hello@randevoo.io'],
        subject: 'New beta signup',
        text: `New beta signup:\n\nEmail: ${email}\nDevice: ${device}`,
      }),
    }).catch(e => console.error('Resend error:', e));

    return json({ ok: true }, 200);
  }

  return env.ASSETS.fetch(request);
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
