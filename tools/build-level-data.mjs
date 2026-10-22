// Writes every level's board pattern to assets/levels.bin (the Scale section's
// 95,000 dots). Moved here from the app repo's website prototype.
//
// Reads <levels>/levels-meta.json + <levels>/<grid>/<activeCells>.json in game
// order (grid 5x5 → 10x10, stage = active cells ascending, level order inside
// the stage file), keeps ONLY the active/passive bits (no solutions — the site
// never publishes them), bit-packs them back to back (rows*cols bits per
// level) and deflate-raw compresses the result. The page fetches the file when
// the Scale section comes near and opens it with
// DecompressionStream("deflate-raw").
//
//   node tools/build-level-data.mjs H:\grid-collection\public\levels
//
// Run it again whenever the app's level files change. The home page's META
// constant (_src/index.html) must match levels-meta.json: the script checks it.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const levelsDir = process.argv[2];
if (!levelsDir) {
  console.error("usage: node tools/build-level-data.mjs <app repo>/public/levels");
  process.exit(1);
}
const outPath = join(root, "assets", "levels.bin");

const meta = JSON.parse(readFileSync(join(levelsDir, "levels-meta.json"), "utf8")).grids;
const bits = [];
for (const grid of Object.keys(meta)) {
  const [rows, cols] = grid.split("x").map(Number);
  const n = rows * cols;
  const stages = Object.keys(meta[grid])
    .map(Number)
    .sort((a, b) => a - b);
  for (const stage of stages) {
    const levels = JSON.parse(readFileSync(join(levelsDir, grid, `${stage}.json`), "utf8"));
    if (levels.length !== meta[grid][stage])
      throw new Error(`${grid}/${stage}: meta says ${meta[grid][stage]}, file has ${levels.length}`);
    for (const level of levels) {
      // same decoding as decodeBinary() in the app's src/levels.ts
      let bin = "";
      for (const ch of level.binary) bin += parseInt(ch, 16).toString(2).padStart(4, "0");
      if (bin.length > n) bin = bin.slice(-n);
      bin = bin.padStart(n, "0");
      const active = [...bin].filter((c) => c === "1").length;
      if (active !== stage) throw new Error(`${grid}/${stage}: a level has ${active} active cells`);
      bits.push(bin);
    }
  }
}

// The page's META constant must describe the same levels, in the same order.
const page = readFileSync(join(root, "_src", "index.html"), "utf8");
const pageMeta = page.match(/const META = (\{[\s\S]*?\n {4}\});/);
if (!pageMeta) throw new Error("_src/index.html has no META constant");
const metaJs = Function(`return ${pageMeta[1]}`)();
for (const grid of Object.keys(meta)) {
  for (const [stage, count] of Object.entries(meta[grid])) {
    if (metaJs[grid]?.[stage] !== count)
      throw new Error(`META in _src/index.html differs from levels-meta.json at ${grid}/${stage}`);
  }
}

const all = bits.join("");
const packed = Buffer.alloc(Math.ceil(all.length / 8));
for (let i = 0; i < all.length; i++) if (all[i] === "1") packed[i >> 3] |= 128 >> (i & 7);
const out = deflateRawSync(packed, { level: 9 });
writeFileSync(outPath, out);
console.log(`${bits.length} levels, ${packed.length} bytes packed, ${out.length} bytes → assets/levels.bin`);
