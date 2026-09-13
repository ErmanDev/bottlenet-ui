const fs = require('fs');
const PATH = '/tmp/bottlenet-device-status.json';

function readStatus() {
  try {
    if (globalThis.__bnStatus) return globalThis.__bnStatus;
    if (fs.existsSync(PATH)) {
      const raw = JSON.parse(fs.readFileSync(PATH, 'utf8'));
      globalThis.__bnStatus = raw;
      return raw;
    }
  } catch { }
  return null;
}

function writeStatus(status) {
  const payload = {
    ok: true,
    status: { ...status, updatedAt: Date.now() }
  };
  globalThis.__bnStatus = payload;
  try { fs.writeFileSync(PATH, JSON.stringify(payload)); } catch { }
  return payload;
}

module.exports = { readStatus, writeStatus };
