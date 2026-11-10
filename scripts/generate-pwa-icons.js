const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  const sourceLogo = path.join(process.cwd(), 'public', 'assets', 'logo.png');
  const iconsDir = path.join(process.cwd(), 'public', 'icons');

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  console.log('Generating PWA icons from:', sourceLogo);

  // 1. Regular transparent icons (Android / Desktop app shortcut & taskbar)
  const sizes = [48, 72, 96, 128, 144, 192, 384, 512];
  for (const size of sizes) {
    const dest = path.join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(sourceLogo)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(dest);
    console.log(`Generated: ${dest}`);
  }

  // 2. Maskable icons (80% safe zone with GEMINI.md primary brand background #5052C9)
  // Maskable icons require a solid background because Android clips them into circles, squircles, or rounded rects.
  // 80% safe zone means the logo occupies 80% of the canvas (padding = 10% on each side).
  const maskableSizes = [192, 512];
  for (const size of maskableSizes) {
    const innerSize = Math.round(size * 0.8);
    const innerLogoBuffer = await sharp(sourceLogo)
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const dest = path.join(iconsDir, `icon-maskable-${size}x${size}.png`);
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 80, g: 82, b: 201, alpha: 1 } // #5052C9 (Primary Brand Token)
      }
    })
      .composite([{ input: innerLogoBuffer, gravity: 'center' }])
      .png()
      .toFile(dest);
    console.log(`Generated maskable: ${dest}`);
  }

  // 3. Apple Touch Icon (180x180 with #5052C9 primary background and safe-area padding)
  const appleInnerSize = 144; // 80% safe zone
  const appleLogoBuffer = await sharp(sourceLogo)
    .resize(appleInnerSize, appleInnerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const appleTouchPath = path.join(iconsDir, 'apple-touch-icon.png');
  const appleTouchRootPath = path.join(process.cwd(), 'public', 'apple-touch-icon.png');

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 80, g: 82, b: 201, alpha: 1 } // #5052C9
    }
  })
    .composite([{ input: appleLogoBuffer, gravity: 'center' }])
    .png()
    .toFile(appleTouchPath);

  fs.copyFileSync(appleTouchPath, appleTouchRootPath);
  console.log(`Generated Apple Touch Icons: ${appleTouchPath} & ${appleTouchRootPath}`);

  console.log('All PWA icon assets generated successfully.');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
