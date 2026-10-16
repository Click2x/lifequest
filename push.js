'use strict';
// Web Push (RFC 8030 / 8291 aes128gcm / RFC 8292 VAPID) using only Node's built-in crypto. No dependencies.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const b64u = b => Buffer.from(b).toString('base64url');
const fromB64u = s => Buffer.from(s, 'base64url');

function mkVapid(jwk) {
  const privateKey = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
  const pub = Buffer.concat([Buffer.from([4]), fromB64u(jwk.x), fromB64u(jwk.y)]);       // uncompressed P-256 point
  return { privateKey, publicB64: b64u(pub), jwk };
}
function loadVapid(dir) {
  const f = path.join(dir, 'vapid.json');
  try { return mkVapid(JSON.parse(fs.readFileSync(f, 'utf8')).privateJwk); } catch { }
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  fs.writeFileSync(f, JSON.stringify({ privateJwk: jwk }), { mode: 0o600 });
  return mkVapid(jwk);
}
function vapidAuth(vapid, endpoint, subject) {
  const h = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const p = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(`${h}.${p}`), { key: vapid.privateKey, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${h}.${p}.${b64u(sig)}, k=${vapid.publicB64}`;
}
const hkdf = (ikm, salt, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

// RFC 8291: encrypt a payload for one subscription (keys.p256dh = browser public key, keys.auth = 16-byte secret)
function encrypt(sub, payload, fixed = {}) {      // `fixed` (ecdh, salt) exists only so tests can use the RFC's known-answer vector
  const ua = fromB64u(sub.keys.p256dh), auth = fromB64u(sub.keys.auth);
  const ecdh = fixed.ecdh || (() => { const e = crypto.createECDH('prime256v1'); e.generateKeys(); return e; })();
  const asPub = ecdh.getPublicKey(), secret = ecdh.computeSecret(ua);
  const ikm = hkdf(secret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub]), 32);
  const salt = fixed.salt || crypto.randomBytes(16);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);   // 0x02 = last-record delimiter
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}
// the browser's side of the same math; used by tools/test-push.js to prove the encryption round-trips
function decrypt(uaEcdh, auth, body) {
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const ua = uaEcdh.getPublicKey(), secret = uaEcdh.computeSecret(asPub);
  const ikm = hkdf(secret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub]), 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16), nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  return pt.subarray(0, pt.lastIndexOf(2)).toString();
}
async function sendPush(vapid, sub, payloadObj, subject = process.env.VAPID_SUBJECT || 'mailto:lifequest@example.com') {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: vapidAuth(vapid, sub.endpoint, subject), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '1800', Urgency: 'normal' },
    body: encrypt(sub, JSON.stringify(payloadObj)),
  });
  return res.status;
}
module.exports = { loadVapid, mkVapid, vapidAuth, encrypt, decrypt, sendPush };
