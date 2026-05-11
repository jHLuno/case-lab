const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, '../public/Logo.png');
const outDir = path.join(__dirname, '../app');

const sizes = [16, 32, 48, 64, 128];

async function generateFavicon() {
  const logo = sharp(logoPath);
  const metadata = await logo.metadata();
  
  // Logo is very wide (4960x1012), we need square favicon
  // Extract the center square portion or pad to square
  const minDim = Math.min(metadata.width, metadata.height);
  const left = Math.floor((metadata.width - minDim) / 2);
  const top = 0;
  
  // Extract center square
  const squareLogo = logo.extract({
    left,
    top,
    width: minDim,
    height: minDim
  });

  // Generate white background version
  const whiteBuffers = await Promise.all(
    sizes.map(async (size) => {
      const buf = await squareLogo
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toBuffer();
      return buf;
    })
  );

  const icoBuffer = await toIco(whiteBuffers);
  fs.writeFileSync(path.join(outDir, 'favicon.ico'), icoBuffer);
  console.log('Generated app/favicon.ico');

  // Also generate black background version for dark mode
  const blackBuffers = await Promise.all(
    sizes.map(async (size) => {
      const buf = await squareLogo
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .png()
        .toBuffer();
      return buf;
    })
  );

  const blackIcoBuffer = await toIco(blackBuffers);
  fs.writeFileSync(path.join(outDir, 'favicon-dark.ico'), blackIcoBuffer);
  console.log('Generated app/favicon-dark.ico');
}

generateFavicon().catch(console.error);
