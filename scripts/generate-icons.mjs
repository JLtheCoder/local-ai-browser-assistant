import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Minimal PNG encoder (8-bit RGBA)
// ---------------------------------------------------------------------------

let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(rgba, size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < stride; x++) raw[rowStart + 1 + x] = rgba[y * stride + x];
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Tiny software rasterizer (supersampled for anti-aliasing)
// ---------------------------------------------------------------------------

const SS = 4; // supersample factor

function blend(buf, S, x, y, [r, g, b], a) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  const dstA = buf[i + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA === 0) return;
  buf[i] = Math.round((r * a + buf[i] * dstA * (1 - a)) / outA);
  buf[i + 1] = Math.round((g * a + buf[i + 1] * dstA * (1 - a)) / outA);
  buf[i + 2] = Math.round((b * a + buf[i + 2] * dstA * (1 - a)) / outA);
  buf[i + 3] = Math.round(outA * 255);
}

/** Fill a rounded rectangle whose color is lerped vertically between two colors. */
function fillRoundedRect(buf, S, x0, y0, x1, y1, radius, colorTop, colorBottom) {
  const r = Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2);
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    const t = Math.min(1, Math.max(0, (y + 0.5 - y0) / (y1 - y0)));
    const color = colorBottom
      ? [
          Math.round(colorTop[0] + (colorBottom[0] - colorTop[0]) * t),
          Math.round(colorTop[1] + (colorBottom[1] - colorTop[1]) * t),
          Math.round(colorTop[2] + (colorBottom[2] - colorTop[2]) * t),
        ]
      : colorTop;
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      const dx = Math.max(x0 + r - (x + 0.5), x + 0.5 - (x1 - r), 0);
      const dy = Math.max(y0 + r - (y + 0.5), y + 0.5 - (y1 - r), 0);
      if (dx * dx + dy * dy <= r * r) blend(buf, S, x, y, color, 1);
    }
  }
}

function fillCircle(buf, S, cx, cy, radius, color, alpha = 1) {
  for (let y = Math.floor(cy - radius); y < Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x < Math.ceil(cx + radius); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= radius * radius) blend(buf, S, x, y, color, alpha);
    }
  }
}

/** Average SS x SS blocks back down to the final icon size (premultiplied). */
function downsample(src, S, size) {
  const out = new Uint8ClampedArray(size * size * 4);
  const n = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * S + (x * SS + sx)) * 4;
          const sa = src[i + 3] / 255;
          r += src[i] * sa;
          g += src[i + 1] * sa;
          b += src[i + 2] * sa;
          a += sa;
        }
      }
      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / n) * 255);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Robot face design
// ---------------------------------------------------------------------------

const INDIGO_TOP = [99, 102, 241]; // indigo-500
const INDIGO_BOTTOM = [67, 56, 202]; // indigo-700
const INDIGO_ANTENNA = [129, 140, 248]; // indigo-400
const WHITE = [255, 255, 255];

function makeIcon(size) {
  const S = size * SS;
  const buf = new Uint8ClampedArray(S * S * 4); // transparent
  const u = (v) => v * S; // fraction of the icon -> buffer pixels

  // Antenna: stem + ball.
  fillRoundedRect(buf, S, u(0.478), u(0.15), u(0.522), u(0.28), u(0.022), INDIGO_ANTENNA);
  fillCircle(buf, S, u(0.5), u(0.112), u(0.062), INDIGO_ANTENNA);

  // Head: rounded square with a subtle top-to-bottom gradient.
  fillRoundedRect(
    buf,
    S,
    u(0.14),
    u(0.245),
    u(0.86),
    u(0.895),
    u(0.155),
    INDIGO_TOP,
    INDIGO_BOTTOM,
  );

  // Eyes.
  fillCircle(buf, S, u(0.36), u(0.5), u(0.088), WHITE);
  fillCircle(buf, S, u(0.64), u(0.5), u(0.088), WHITE);

  // Mouth.
  fillRoundedRect(buf, S, u(0.375), u(0.675), u(0.625), u(0.745), u(0.035), WHITE);

  return encodePng(downsample(buf, S, size), size);
}

const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const file = join(outDir, `icon${size}.png`);
  writeFileSync(file, makeIcon(size));
  console.log(`wrote ${file}`);
}
