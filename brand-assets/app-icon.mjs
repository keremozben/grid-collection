// app-icon.mjs — derive the site logo and favicons from the app icon.
//
//   npm i -D sharp
//   node brand-assets/app-icon.mjs
//
// Source: brand-assets/app-icon-512.png (copy of the store icon,
// H:\grid-collection\assets\play-store-icon-512.png). Outputs into the SITE ROOT:
//   ../app-icon-128.png  ../favicon-32x32.png  ../favicon-192x192.png
//   ../apple-touch-icon.png  ../favicon.ico (16/32/48, PNG-compressed)
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, ".."); // site root
const src = join(here, "app-icon-512.png");

const png = (size) =>
  sharp(src).resize(size, size, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();

const targets = [
  { out: "app-icon-128.png", size: 128 }, // header logo (shown at ~34 px, sharp up to 3x)
  { out: "favicon-32x32.png", size: 32 },
  { out: "favicon-192x192.png", size: 192 },
  { out: "apple-touch-icon.png", size: 180 }, // full-bleed: iOS rounds the corners itself
];
for (const t of targets) {
  await writeFile(join(root, t.out), await png(t.size));
  console.log(`✓ ${t.out}  (${t.size}×${t.size})`);
}

// favicon.ico: ICONDIR + one ICONDIRENTRY per size, then the PNG images.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(png));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(size, e); // width
  header.writeUInt8(size, e + 1); // height
  header.writeUInt16LE(1, e + 4); // colour planes
  header.writeUInt16LE(32, e + 6); // bits per pixel
  header.writeUInt32LE(images[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
await writeFile(join(root, "favicon.ico"), Buffer.concat([header, ...images]));
console.log(`✓ favicon.ico  (${sizes.join("/")})`);
