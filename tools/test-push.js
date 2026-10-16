// Verifies the Web Push implementation without a real push service:
//  1. encrypts for a fake "browser" subscription and decrypts it again (RFC 8291 round trip)
//  2. checks the VAPID JWT signature against the advertised public key (RFC 8292)
//  3. sends through a local fake gateway and inspects the headers and body it receives
// Run: node tools/test-push.js
const crypto = require('crypto');
const http = require('http');
const assert = require('assert');
const push = require('../push');

const b64u = b => Buffer.from(b).toString('base64url');
const vapid = push.mkVapid(crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' }));

// the "browser": an ECDH key pair plus a 16-byte auth secret, as PushManager.subscribe() creates
const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
const auth = crypto.randomBytes(16);
const sub = { endpoint: 'http://127.0.0.1:0/push', keys: { p256dh: b64u(ua.getPublicKey()), auth: b64u(auth) } };

// 1. encryption round trip, including a non-ASCII payload
const msg = JSON.stringify({ title: '🔔 Time for: Deep work', body: 'Just begin. Two minutes is enough to start.', tag: 'b:x:go:2026-10-05' });
const body = push.encrypt(sub, msg);
assert.strictEqual(push.decrypt(ua, auth, body), msg);
assert.strictEqual(body[20], 65, 'key id length must be 65');
assert.strictEqual(body.readUInt32BE(16), 4096, 'record size');
assert.notStrictEqual(Buffer.compare(push.encrypt(sub, msg), body), 0, 'fresh salt and key every time');
console.log('✓ payload encrypts and decrypts (RFC 8291 aes128gcm)');

// 1b. RFC 8291 Appendix A known-answer test: fixed keys and salt must reproduce the RFC's exact bytes
{
  const asEcdh = crypto.createECDH('prime256v1'); asEcdh.setPrivateKey(Buffer.from('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', 'base64url'));
  const rfcSub = { keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' } };
  const got = push.encrypt(rfcSub, 'When I grow up, I want to be a watermelon', { ecdh: asEcdh, salt: Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url') }).toString('base64url');
  const want = 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
  assert.strictEqual(got, want); console.log('✓ matches the RFC 8291 Appendix A test vector byte for byte');
}

// 2. VAPID signature
const auth1 = push.vapidAuth(vapid, 'https://fcm.googleapis.com/fcm/send/abc', 'mailto:me@example.com');
const m = auth1.match(/^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/); assert(m, 'header format');
const [, h, p, sig, k] = m;
assert.strictEqual(k, vapid.publicB64);
const pub = Buffer.from(k, 'base64url'); assert.strictEqual(pub.length, 65); assert.strictEqual(pub[0], 4);
const pubKey = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: 'jwk' });
assert(crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key: pubKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')), 'signature verifies');
const claims = JSON.parse(Buffer.from(p, 'base64url')); assert.strictEqual(claims.aud, 'https://fcm.googleapis.com'); assert(claims.exp > Date.now() / 1000);
assert.strictEqual(JSON.parse(Buffer.from(h, 'base64url')).alg, 'ES256');
console.log('✓ VAPID JWT is ES256, correctly scoped, and verifies against the public key');

// 3. end to end through a fake gateway
const srv = http.createServer((req, res) => {
  const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
    try {
      assert.strictEqual(req.headers['content-encoding'], 'aes128gcm'); assert(req.headers.ttl); assert(/^vapid t=.+, k=.+$/.test(req.headers.authorization));
      const got = JSON.parse(push.decrypt(ua, auth, Buffer.concat(chunks))); assert.strictEqual(got.title, '🔔 hello');
      res.writeHead(201); res.end(); console.log('✓ gateway received a valid, decryptable, authenticated request'); srv.close();
    } catch (e) { res.writeHead(500); res.end(); console.error('✗', e.message); process.exitCode = 1; srv.close(); }
  });
});
srv.listen(0, '127.0.0.1', async () => {
  sub.endpoint = `http://127.0.0.1:${srv.address().port}/push`;
  const status = await push.sendPush(vapid, sub, { title: '🔔 hello', body: 'x', tag: 't' });
  assert.strictEqual(status, 201); console.log('✓ sendPush returned 201');
});
