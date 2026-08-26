/**
 * EventPro Mock API Server
 * Run: node mock-server.js
 * Serves on http://localhost:3001
 *
 * Simulates the full Laravel API so the frontend can be tested
 * without any PHP / AWS / DynamoDB setup.
 */

const http = require('http');
const crypto = require('crypto');

// ── In-memory data store ─────────────────────────────────────────────────────
const db = {
  events: [
    {
      eventId: 'evt-demo-001',
      name: 'Auckland Tech Meetup 2026',
      date: '2026-09-15',
      venue: 'GridAKL, Auckland',
      privacy: 'Public',
      organiserId: 'user-saleh',
      status: 'Upcoming',
      participantCount: 12,
      photoCount: 3,
      createdAt: new Date().toISOString(),
    },
    {
      eventId: 'evt-demo-002',
      name: 'UoA AI Research Showcase',
      date: '2026-08-30',
      venue: 'University of Auckland, Auckland',
      privacy: 'Protected',
      organiserId: 'user-other',
      status: 'Active',
      participantCount: 45,
      photoCount: 20,
      createdAt: new Date().toISOString(),
    },
    {
      eventId: 'evt-demo-003',
      name: 'Wellington Photo Walk',
      date: '2026-07-01',
      venue: 'Wellington Waterfront',
      privacy: 'Public',
      organiserId: 'user-other',
      status: 'Archived',
      participantCount: 8,
      photoCount: 55,
      createdAt: new Date().toISOString(),
    },
  ],
  photos: [],
  tokens: {},
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function uuid() { return 'id-' + crypto.randomUUID(); }

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function getToken(req) {
  const auth = req.headers['authorization'] || '';
  return auth.replace('Bearer ', '');
}

function getUserFromToken(token) {
  if (!token) return null;
  if (token.startsWith('mock-token-')) {
    return { id: token.replace('mock-token-', ''), email: token.replace('mock-token-', '') + '@demo.com' };
  }
  return null;
}

// ── Router ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url   = req.url.split('?')[0];
  const query = Object.fromEntries(new URLSearchParams(req.url.split('?')[1] || ''));
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') return send(res, 204, {});

  // Strip /api prefix
  const path = url.replace(/^\/api/, '');

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (method === 'POST' && path === '/auth/login') {
    const { email, password } = await readBody(req);
    if (!email || !password) return send(res, 422, { error: 'Email and password required' });
    const userId = email.replace(/[@.]/g, '-');
    const token  = 'mock-token-' + userId;
    return send(res, 200, { token, user: { id: userId, email } });
  }

  if (method === 'POST' && path === '/auth/register') {
    return send(res, 200, { message: 'Registered (mock)' });
  }

  if (method === 'POST' && path === '/auth/change-password') {
    return send(res, 200, { message: 'Password changed (mock)' });
  }

  // ── Auth guard for everything else ────────────────────────────────────────
  const user = getUserFromToken(getToken(req));
  if (!user) return send(res, 401, { error: 'Unauthenticated' });

  // ── Events ────────────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/events') {
    let events = [...db.events];
    if (query.organiser === 'me') {
      events = events.filter(e => e.organiserId === user.id);
    }
    if (query.status) {
      events = events.filter(e => e.status === query.status);
    }
    return send(res, 200, events);
  }

  if (method === 'POST' && path === '/events') {
    const body = await readBody(req);
    if (!body.name || !body.date || !body.venue || !body.privacy) {
      return send(res, 422, { error: 'All fields required' });
    }
    const newEvent = {
      eventId: 'evt-' + Date.now(),
      name: body.name,
      date: body.date,
      venue: body.venue,
      privacy: body.privacy,
      organiserId: user.id,
      status: 'Upcoming',
      participantCount: 0,
      photoCount: 0,
      createdAt: new Date().toISOString(),
    };
    db.events.unshift(newEvent);
    return send(res, 201, newEvent);
  }

  const eventMatch = path.match(/^\/events\/([^/]+)$/);
  if (method === 'GET' && eventMatch) {
    const event = db.events.find(e => e.eventId === eventMatch[1]);
    if (!event) return send(res, 404, { error: 'Event not found' });
    return send(res, 200, event);
  }

  if (method === 'PATCH' && eventMatch) {
    const idx = db.events.findIndex(e => e.eventId === eventMatch[1]);
    if (idx === -1) return send(res, 404, { error: 'Event not found' });
    const body = await readBody(req);
    db.events[idx] = { ...db.events[idx], ...body };
    return send(res, 200, db.events[idx]);
  }

  // ── Photos ────────────────────────────────────────────────────────────────
  const uploadUrlMatch = path.match(/^\/events\/([^/]+)\/upload-url$/);
  if (method === 'POST' && uploadUrlMatch) {
    const { filename, mime } = await readBody(req);
    const photoId = 'photo-' + Date.now();
    return send(res, 200, {
      photoId,
      uploadUrl: 'http://localhost:3001/stub-upload/' + photoId,
      key: 'originals/' + uploadUrlMatch[1] + '/' + photoId + '/' + filename,
      note: 'Mock server — no real S3 upload',
    });
  }

  const uploadedMatch = path.match(/^\/events\/([^/]+)\/uploaded$/);
  if (method === 'POST' && uploadedMatch) {
    const body = await readBody(req);
    const photo = {
      photoId: body.photoId,
      eventId: uploadedMatch[1],
      s3Key: body.key,
      thumbKey: null,
      uploadedBy: user.id,
      uploadedAt: new Date().toISOString(),
      matchedUsers: [],
      processed: false,
    };
    db.photos.push(photo);
    // Update photoCount on the event
    const ev = db.events.find(e => e.eventId === uploadedMatch[1]);
    if (ev) ev.photoCount = (ev.photoCount || 0) + 1;
    return send(res, 201, { message: 'Photo queued', photo });
  }

  const galleryMatch = path.match(/^\/gallery\/([^/]+)$/);
  if (method === 'GET' && galleryMatch) {
    const photos = db.photos.filter(p => p.eventId === galleryMatch[1]);
    return send(res, 200, photos);
  }

  if (method === 'GET' && path === '/photos/mine') {
    return send(res, 200, []);
  }

  if (method === 'POST' && path === '/search/selfie') {
    return send(res, 200, { matches: [], note: 'Mock server — AI face search not available' });
  }

  // Stub upload endpoint (just acknowledge)
  if (path.startsWith('/stub-upload/')) {
    return send(res, 200, { ok: true });
  }

  send(res, 404, { error: 'Route not found: ' + method + ' ' + path });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log('');
  console.log('✅ EventPro Mock API running on http://localhost:' + PORT);
  console.log('');
  console.log('Endpoints:');
  console.log('  POST /api/auth/login');
  console.log('  GET  /api/events');
  console.log('  POST /api/events');
  console.log('  GET  /api/events/:id');
  console.log('  POST /api/events/:id/upload-url');
  console.log('  POST /api/events/:id/uploaded');
  console.log('  GET  /api/gallery/:event_id');
  console.log('  GET  /api/photos/mine');
  console.log('  POST /api/search/selfie');
  console.log('');
  console.log('3 demo events pre-loaded in memory.');
  console.log('');
});
