// Generate Play Store assets from the project's existing icon + screenshots.
//
// Run: node scripts/generate-play-assets.js
//
// Outputs to assets/play-store/:
//   - icon-512.png            (512x512, no alpha)
//   - feature-graphic.png     (1024x500, no alpha)
//   - screenshots/<name>.png  (copies of assets/screenshots/*.png)
//
// Requires `sharp` (already in devDependencies).

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "assets", "play-store");
const SCREENSHOTS_OUT = path.join(OUT_DIR, "screenshots");

const BRAND = { r: 79, g: 70, b: 229, alpha: 1 }; // #4F46E5
const BRAND_HEX = "#4F46E5";

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

async function genIcon512() {
  const src = path.join(ROOT, "assets", "images", "icon.png");
  const out = path.join(OUT_DIR, "icon-512.png");

  await sharp(src)
    .resize(512, 512, { fit: "cover" })
    .flatten({ background: BRAND }) // strip alpha onto brand colour
    .png({ compressionLevel: 9 })
    .toFile(out);

  console.log("[icon] wrote", out);
}

async function genFeatureGraphic() {
  const iconSrc = path.join(ROOT, "assets", "images", "icon.png");
  const out = path.join(OUT_DIR, "feature-graphic.png");

  // Resized icon (250x250, rounded square with shadow via SVG mask) sitting on
  // the left third of the banner.
  const iconBuf = await sharp(iconSrc)
    .resize(250, 250, { fit: "cover" })
    .png()
    .toBuffer();

  // SVG layer: brand-colour background + text (Latin only — Roboto/system fonts
  // render reliably in sharp).
  const overlaySvg = Buffer.from(`
    <svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"  stop-color="#4F46E5"/>
          <stop offset="100%" stop-color="#6366F1"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="500" fill="url(#g)"/>
      <text x="400" y="230"
            font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="92" font-weight="800" fill="white"
            letter-spacing="-2">
        SplitBite
      </text>
      <text x="402" y="290"
            font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="34" font-weight="500" fill="rgba(255,255,255,0.92)">
        Split bills, not friendships
      </text>
      <text x="402" y="340"
            font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="22" font-weight="400" fill="rgba(255,255,255,0.75)">
        Group orders · Item-level splits · Real-time
      </text>
    </svg>
  `);

  const composited = await sharp({
    create: {
      width: 1024,
      height: 500,
      channels: 4,
      background: BRAND,
    },
  })
    .composite([
      { input: overlaySvg, top: 0, left: 0 },
      { input: iconBuf, top: 125, left: 110 },
    ])
    .png()
    .toBuffer();

  // Re-encode without alpha so Play never complains about transparency.
  await sharp(composited)
    .flatten({ background: BRAND })
    .png({ compressionLevel: 9 })
    .toFile(out);

  console.log("[feature] wrote", out);
}

async function copyScreenshots() {
  const srcDir = path.join(ROOT, "assets", "screenshots");
  const files = (await fs.promises.readdir(srcDir)).filter(
    (f) => f.endsWith(".png") && !f.startsWith("ipad-")
  );

  for (const f of files) {
    const src = path.join(srcDir, f);
    const dst = path.join(SCREENSHOTS_OUT, f);
    // Strip alpha + re-encode to be safe (Play accepts alpha but some tools
    // choke on huge alpha files; this just makes them deterministic).
    await sharp(src)
      .flatten({ background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png({ compressionLevel: 9 })
      .toFile(dst);
    console.log("[screenshot] wrote", dst);
  }
}

async function main() {
  await ensureDir(OUT_DIR);
  await ensureDir(SCREENSHOTS_OUT);
  await genIcon512();
  await genFeatureGraphic();
  await copyScreenshots();
  console.log("\nAll Play Store assets generated under assets/play-store/.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
