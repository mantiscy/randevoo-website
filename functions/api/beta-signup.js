export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { email, device } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (!['ios', 'android'].includes(device)) {
    return new Response(JSON.stringify({ error: 'Invalid device' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Insert into Supabase — ON CONFLICT DO NOTHING so duplicate emails are silently ignored
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
    console.error('Supabase insert error:', err);
    return new Response(JSON.stringify({ error: 'Database error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  // Notify hello@randevoo.io via Resend
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

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
