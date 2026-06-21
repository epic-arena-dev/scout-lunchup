const zlib = require("zlib")
const fs = require("fs")
const path = require("path")

function crc32(buf) {
  let crc = 0xffffffff
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeB = Buffer.from(type, "ascii")
  const crcVal = crc32(Buffer.concat([typeB, data]))
  const crcB = Buffer.alloc(4)
  crcB.writeUInt32BE(crcVal, 0)
  return Buffer.concat([len, typeB, data, crcB])
}

function createPNG(width, height, r, g, b, a) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const off = y * (width * 4 + 1) + 1 + x * 4
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = a
    }
  }
  return Buffer.concat([sig, createChunk("IHDR", ihdr), createChunk("IDAT", zlib.deflateSync(raw)), createChunk("IEND", Buffer.alloc(0))])
}

const SIZE = 81
const outDir = path.join(__dirname, "..", "src", "assets", "tabbar")

const icons = {
  dashboard: { shape: "grid" },
  projects: { shape: "folder" },
  advisor: { shape: "chat" },
  profile: { shape: "user" },
}

function drawShape(buf, w, h, r, g, b, shape) {
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2)
  const s = Math.floor(w * 0.3)

  if (shape === "grid") {
    for (let y = cy - s; y <= cy + s; y++) {
      for (let x = cx - s; x <= cx + s; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue
        const edge = Math.abs(x - cx) > s - 4 || Math.abs(y - cy) > s - 4
        const crossX = Math.abs(x - cx) < 4 || Math.abs(y - cy) < 4
        if (edge || crossX) setPixel(buf, w, x, y, r, g, b)
      }
    }
  } else if (shape === "folder") {
    const top = cy - s, bot = cy + s, left = cx - s, right = cx + s
    for (let y = top; y <= bot; y++) {
      for (let x = left; x <= right; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue
        if (x === left || x === right || y === bot || (y === top && x < cx + 6)) setPixel(buf, w, x, y, r, g, b)
      }
    }
    for (let x = cx - s; x <= cx + 6; x++) {
      for (let y = top - 8; y < top; y++) {
        if (x >= 0 && x < w && y >= 0 && y < h) setPixel(buf, w, x, y, r, g, b)
      }
    }
  } else if (shape === "chat") {
    for (let y = cy - s; y <= cy + s - 8; y++) {
      for (let x = cx - s; x <= cx + s; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue
        const d = Math.abs(x - cx) < 3 || Math.abs(y - (cy - s)) < 3
        if (d) setPixel(buf, w, x, y, r, g, b)
      }
    }
    for (let y = cy + 2; y <= cy + s; y++) {
      const dx = y - (cy + 2)
      for (let x = cx - s + dx; x <= cx + 6; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) setPixel(buf, w, x, y, r, g, b)
      }
    }
  } else if (shape === "user") {
    const headR = Math.floor(s * 0.6)
    for (let y = cy - s; y <= cy; y++) {
      for (let x = cx - s; x <= cx + s; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue
        if (Math.sqrt((x - cx) ** 2 + (y - (cy - s + headR)) ** 2) <= headR + 2 &&
            Math.sqrt((x - cx) ** 2 + (y - (cy - s + headR)) ** 2) >= headR - 2) {
          setPixel(buf, w, x, y, r, g, b)
        }
        const inBody = y >= cy + 4 && Math.abs(x - cx) < s && y <= cy + s
        const bodyEdge = inBody && (Math.abs(x - (cx - s)) < 3 || Math.abs(x - (cx + s)) < 3 || Math.abs(y - (cy + s)) < 3)
        if (bodyEdge) setPixel(buf, w, x, y, r, g, b)
      }
    }
  }
}

function setPixel(buf, w, x, y, r, g, b) {
  const off = y * (w * 4 + 1) + 1 + x * 4
  buf[off] = r; buf[off + 1] = g; buf[off + 2] = b; buf[off + 3] = 255
}

for (const [name, { shape }] of Object.entries(icons)) {
  // Active (primary color on transparent bg)
  const rawActive = Buffer.alloc((SIZE * 4 + 1) * SIZE)
  for (let y = 0; y < SIZE; y++) {
    rawActive[y * (SIZE * 4 + 1)] = 0
    for (let x = 0; x < SIZE; x++) {
      const off = y * (SIZE * 4 + 1) + 1 + x * 4
      rawActive[off] = 0; rawActive[off + 1] = 0; rawActive[off + 2] = 0; rawActive[off + 3] = 0
    }
  }
  const r = parseInt("16", 16), g = parseInt("5D", 16), b = parseInt("FF", 16)
  drawShape(rawActive, SIZE, SIZE, r, g, b, shape)
  fs.writeFileSync(path.join(outDir, `${name}-active.png`),
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      createChunk("IHDR", (() => { const h = Buffer.alloc(13); h.writeUInt32BE(SIZE, 0); h.writeUInt32BE(SIZE, 4); h[8] = 8; h[9] = 6; h[10] = 0; h[11] = 0; h[12] = 0; return h; })()),
      createChunk("IDAT", zlib.deflateSync(rawActive)), createChunk("IEND", Buffer.alloc(0))]))

  // Inactive (secondary color on transparent bg)
  const rawInactive = Buffer.alloc((SIZE * 4 + 1) * SIZE)
  for (let y = 0; y < SIZE; y++) {
    rawInactive[y * (SIZE * 4 + 1)] = 0
    for (let x = 0; x < SIZE; x++) {
      const off = y * (SIZE * 4 + 1) + 1 + x * 4
      rawInactive[off] = 0; rawInactive[off + 1] = 0; rawInactive[off + 2] = 0; rawInactive[off + 3] = 0
    }
  }
  const ir = parseInt("86", 16), ig = parseInt("90", 16), ib = parseInt("9C", 16)
  drawShape(rawInactive, SIZE, SIZE, ir, ig, ib, shape)
  fs.writeFileSync(path.join(outDir, `${name}.png`),
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      createChunk("IHDR", (() => { const h = Buffer.alloc(13); h.writeUInt32BE(SIZE, 0); h.writeUInt32BE(SIZE, 4); h[8] = 8; h[9] = 6; h[10] = 0; h[11] = 0; h[12] = 0; return h; })()),
      createChunk("IDAT", zlib.deflateSync(rawInactive)), createChunk("IEND", Buffer.alloc(0))]))
}

console.log("Generated 8 tabbar icons in", outDir)
