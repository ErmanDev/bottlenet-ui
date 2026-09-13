const { readStatus, writeStatus } = require('../lib/store');

const KEY = process.env.BOTTLENET_INGEST_KEY || 'bottlenet-dev-key';

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }
    if (typeof req.body === 'string') {
      try { resolve(JSON.parse(req.body)); } catch (e) { reject(e); }
      return;
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (!raw) { resolve(null); return; }
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-BottleNet-Key');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    const data = readStatus();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    if (!data || !data.status) {
      res.end(JSON.stringify({ ok: true, status: null, message: 'waiting for ESP8266 ingest' }));
      return;
    }
    res.end(JSON.stringify(data));
    return;
  }

  if (req.method === 'POST') {
    const got = req.headers['x-bottlenet-key'];
    if (got !== KEY) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
      return;
    }
    if (!body || typeof body !== 'object') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'json body required' }));
      return;
    }
    // Accept either ESP flat status or {"status":{...}} wrapper
    const statusObj = (body.status && typeof body.status === 'object' && !Array.isArray(body.status))
      ? body.status
      : body;
    const saved = writeStatus(statusObj);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, updatedAt: saved.status.updatedAt }));
    return;
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: 'GET or POST only' }));
};
