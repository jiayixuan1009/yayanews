const fs = require('fs');
const path = require('path');

async function main() {
  const src = 'C:/Users/admin/.gemini/antigravity/brain/27332de2-1343-420f-bc0a-852b7aa0d839/media__1775040684861.png';
  const outDir = 'd:/news/yayanews-production/apps/web/public/brand';
  const appDir = 'd:/news/yayanews-production/apps/web/src/app';

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // For this local env, since Sharp might not be installed, we just copy the square png.
  // Next.js Image component will handle the resizing and optimization from this file dynamically at runtime!
  fs.copyFileSync(src, path.join(outDir, 'logo-square.png'));
  fs.copyFileSync(src, path.join(appDir, 'icon.png'));
  fs.copyFileSync(src, path.join(appDir, 'apple-icon.png'));
  fs.copyFileSync(src, path.join(appDir, 'opengraph-image.png'));
  fs.copyFileSync(src, path.join(appDir, 'twitter-image.png'));
  
  // also delete old
  try {
     fs.unlinkSync('d:/news/yayanews-production/apps/web/public/images/logo.png');
     fs.unlinkSync('d:/news/yayanews-production/apps/web/public/images/og-default.png');
  } catch(err) {}

  console.log('done!');
}

main();
