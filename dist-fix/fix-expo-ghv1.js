const fs = require('fs');
const path = require('path');

// Config
const repoName = '/CGPTTimestamp';
const distDir = path.join(__dirname, '..', 'dist');
const fixDir = path.join(__dirname);
const nojekyllSrc = path.join(fixDir, '.nojekyll');
const nojekyllDest = path.join(distDir, '.nojekyll');
const indexHtmlPath = path.join(distDir, 'index.html');

// 1. Copy .nojekyll
fs.copyFileSync(nojekyllSrc, nojekyllDest);
console.log('✓ Copied .nojekyll');

// 2. Read and modify index.html
let html = fs.readFileSync(indexHtmlPath, 'utf-8');

// Add <base href="..."> after <title>
html = html.replace(/<title>(.*?)<\/title>/, (match, titleText) => {
  return `<title>${titleText}</title>\n  <base href="/${repoName}/">`;
});

// Remove leading / in href/src
html = html.replace(/(href|src)="\/(.*?)"/g, '$1="$2"');

fs.writeFileSync(indexHtmlPath, html, 'utf-8');
console.log('✓ Patched index.html');
