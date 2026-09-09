import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

// The exact share-env website logo on a dark rounded background
const cleanSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#060a12"/>
  <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" fill="none" stroke="rgba(61,255,176,0.3)" stroke-width="1"/>
  <rect x="5" y="7" width="22" height="18" rx="3" fill="none" stroke="#3dffb0" stroke-width="2"/>
  <path d="M12.5 12L9.5 16L12.5 20" fill="none" stroke="#3dffb0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M19.5 12L22.5 16L19.5 20" fill="none" stroke="#00d4ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Builds a standard Windows ICO file from an array of PNG buffers.
 * Each entry has: { width, height, buffer }
 */
function createIco(images) {
  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  const imageBuffers = [];

  for (const img of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // color palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // image offset

    dirEntries.push(entry);
    imageBuffers.push(img.buffer);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageBuffers]);
}

async function generate() {
  console.log('Generating favicon assets from share-env logo...');

  // 1. Write favicon.svg
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), cleanSvg, 'utf8');
  console.log('✓ Written public/favicon.svg');

  // 2. Generate PNGs at multiple sizes
  const sizes = [16, 32, 48, 64, 180, 192, 512];
  const pngBuffers = {};

  for (const size of sizes) {
    const buf = await sharp(Buffer.from(cleanSvg))
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers[size] = buf;
  }

  fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), pngBuffers[16]);
  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), pngBuffers[32]);
  fs.writeFileSync(path.join(publicDir, 'favicon-48x48.png'), pngBuffers[48]);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pngBuffers[180]);
  fs.writeFileSync(path.join(publicDir, 'android-chrome-192x192.png'), pngBuffers[192]);
  fs.writeFileSync(path.join(publicDir, 'android-chrome-512x512.png'), pngBuffers[512]);
  console.log('✓ Written PNG favicons (16x16, 32x32, 48x48, 180x180, 192x192, 512x512)');

  // 3. Build multi-resolution favicon.ico containing 16x16, 32x32, 48x48
  const icoBuffer = createIco([
    { width: 16, height: 16, buffer: pngBuffers[16] },
    { width: 32, height: 32, buffer: pngBuffers[32] },
    { width: 48, height: 48, buffer: pngBuffers[48] }
  ]);

  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log(`✓ Written public/favicon.ico (${icoBuffer.length} bytes, 3 resolutions)`);

  // Also write to dist/ if dist exists
  const distDir = path.resolve(__dirname, '../dist');
  if (fs.existsSync(distDir)) {
    fs.copyFileSync(path.join(publicDir, 'favicon.svg'), path.join(distDir, 'favicon.svg'));
    fs.copyFileSync(path.join(publicDir, 'favicon.ico'), path.join(distDir, 'favicon.ico'));
    fs.copyFileSync(path.join(publicDir, 'favicon-16x16.png'), path.join(distDir, 'favicon-16x16.png'));
    fs.copyFileSync(path.join(publicDir, 'favicon-32x32.png'), path.join(distDir, 'favicon-32x32.png'));
    fs.copyFileSync(path.join(publicDir, 'apple-touch-icon.png'), path.join(distDir, 'apple-touch-icon.png'));
    console.log('✓ Copied favicon assets to dist/');
  }

  console.log('All favicon assets generated successfully!');
}

generate().catch(err => {
  console.error('Error generating favicons:', err);
  process.exit(1);
});
