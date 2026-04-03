import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  const isDirectory = stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function processApp(appName) {
  const appDir = path.join(rootDir, 'apps', appName);
  let standaloneDir = path.join(appDir, '.next', 'standalone');

  if (!fs.existsSync(standaloneDir)) {
    standaloneDir = path.join(rootDir, '.next', 'standalone');
    if (!fs.existsSync(standaloneDir)) {
      console.log(`[${appName}] Standalone not found at local or root, skipping.`);
      return;
    }
  }

  const staticSrc = path.join(appDir, '.next', 'static');
  const staticDest = path.join(standaloneDir, 'apps', appName, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    console.log(`[${appName}] Copying static assets to standalone...`);
    copyRecursiveSync(staticSrc, staticDest);
  }

  const publicSrc = path.join(appDir, 'public');
  const publicDest = path.join(standaloneDir, 'apps', appName, 'public');
  if (fs.existsSync(publicSrc)) {
    console.log(`[${appName}] Copying public assets to standalone...`);
    copyRecursiveSync(publicSrc, publicDest);
  }

  // Next.js 14 Standalone bug workaround: App Router metadata images dynamically require image-optimizer
  const nextServerSrc = path.join(rootDir, 'node_modules', 'next', 'dist', 'server', 'image-optimizer.js');
  const nextServerDest = path.join(standaloneDir, 'node_modules', 'next', 'dist', 'server', 'image-optimizer.js');
  if (fs.existsSync(nextServerSrc)) {
    console.log(`[${appName}] Copying missing image-optimizer.js to standalone...`);
    // Ensure dir exists
    fs.mkdirSync(path.dirname(nextServerDest), { recursive: true });
    fs.copyFileSync(nextServerSrc, nextServerDest);
  }
  
  // also copy next/dist/shared/lib/image-config-context.js if it helps 
  const squooshSrc = path.join(rootDir, 'node_modules', 'next', 'dist', 'server', 'lib', 'squoosh');
  const squooshDest = path.join(standaloneDir, 'node_modules', 'next', 'dist', 'server', 'lib', 'squoosh');
  if (fs.existsSync(squooshSrc)) {
    console.log(`[${appName}] Copying missing squoosh optimizer lib to standalone...`);
    copyRecursiveSync(squooshSrc, squooshDest);
  }

  console.log(`[${appName}] ✅ Successfully prepared standalone directory.`);
}

console.log('--- Preparing Standalone Builds ---');
processApp('web');
processApp('admin');
