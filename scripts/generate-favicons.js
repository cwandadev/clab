import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const sizes = [16, 32, 64, 192, 512];
const publicDir = join(process.cwd(), 'public');

// Ensure public directory exists
mkdirSync(publicDir, { recursive: true });

async function generateFavicons() {
  try {
    const svgPath = join(publicDir, 'clab.svg');
    const svgBuffer = readFileSync(svgPath);

    // Generate PNG favicons
    for (const size of sizes) {
      const pngPath = join(publicDir, `favicon-${size}x${size}.png`);
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(pngPath);
      console.log(`✓ Generated ${pngPath}`);
    }

    // Generate WebP
    const webpPath = join(publicDir, 'favicon.webp');
    await sharp(svgBuffer)
      .resize(512, 512)
      .webp({ quality: 90 })
      .toFile(webpPath);
    console.log(`✓ Generated ${webpPath}`);

    // Generate Apple touch icon (180x180)
    const appleIconPath = join(publicDir, 'apple-touch-icon.png');
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(appleIconPath);
    console.log(`✓ Generated ${appleIconPath}`);

    console.log('\n✅ All favicons generated successfully!');
  } catch (error) {
    console.error('Error generating favicons:', error);
    process.exit(1);
  }
}

generateFavicons();