export default {
  async fetch(request, env) {
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

      // Insert into Supabase — duplicate emails silently ignored
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
        const err = await supabaseRes.text();
        console.error('Supabase error:', err);
        return json({ error: 'Database error' }, 500);
      }

      // Notify hello@randevoo.io
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
      }).catch(err => console.error('Resend error:', err));

      return json({ ok: true }, 200);
    }

    // All other requests → static assets
    return env.ASSETS.fetch(request);
  },
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
