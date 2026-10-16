// Generates PNG app icons (no dependencies). Run: node tools/make-icons.js
const fs = require('fs'), zlib = require('zlib'), path = require('path');

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// 5-point star polygon
function star(cx, cy, R, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
  return pts;
}
function inPoly(x, y, p) {
  let ins = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) ins = !ins;
  }
  return ins;
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function render(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.62 : 0.78;          // keep star inside the maskable safe zone
  const R = size * 0.5 * scale, r = R * 0.42, cx = size / 2, cy = size / 2 + R * 0.06;
  const poly = star(cx, cy, R, r);
  const radius = maskable ? 0 : size * 0.22;      // rounded corners for non-maskable
  const SS = 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const t = (x + y) / (2 * size);
    const bg = mix([124, 58, 237], [30, 27, 75], t);   // violet -> deep indigo
    let a = 0, starHits = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const px = x + (sx + .5) / SS, py = y + (sy + .5) / SS;
      // rounded rect coverage
      const dx = Math.max(radius - px, px - (size - radius), 0), dy = Math.max(radius - py, py - (size - radius), 0);
      if (dx * dx + dy * dy <= radius * radius) a++;
      if (inPoly(px, py, poly)) starHits++;
    }
    const cov = a / (SS * SS), sh = starHits / (SS * SS);
    const col = mix(bg, [253, 224, 71], sh);           // gold star
    const o = (y * size + x) * 4;
    buf[o] = col[0]; buf[o + 1] = col[1]; buf[o + 2] = col[2]; buf[o + 3] = Math.round(cov * 255);
  }
  return png(size, size, buf);
}

const out = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(out, 'icon-192.png'), render(192, {}));
fs.writeFileSync(path.join(out, 'icon-512.png'), render(512, {}));
fs.writeFileSync(path.join(out, 'icon-180.png'), render(180, { maskable: true }));   // iOS rounds it itself
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), render(512, { maskable: true }));
console.log('icons written to', out);
