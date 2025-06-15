// dist-fix/fix-expo-gh.js

// This script patches the generated Expo web build for GitHub Pages deployment.
// It ensures:
// 1. The <base href> in index.html points to your repository.
// 2. Absolute asset URLs within index.html, and crucially, within
//    the bundled JavaScript and CSS files, are rewritten to include
//    your repository name. This fixes font/image 404s and the SyntaxError.
// 3. The .nojekyll file is copied to the build directory for GitHub Pages.

const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
// IMPORTANT: Set this to the name of your GitHub repository.
// Include leading and trailing slashes for path consistency.
const REPO_NAME = '/CGPTTimestamp/';

// The directory where 'expo export -p web' outputs its files.
// Usually 'dist' for newer Expo versions, or 'web-build' for older ones.
const BUILD_DIR = 'dist';
// --- END CONFIGURATION ---

const buildDirPath = path.join(__dirname, '..', BUILD_DIR);
const indexPath = path.join(buildDirPath, 'index.html');
const nojekyllSrc = path.join(__dirname, '.nojekyll'); // Assuming .nojekyll is in dist-fix/
const nojekyllDest = path.join(buildDirPath, '.nojekyll'); // Destination in dist/

console.log(`Patching files in: ${buildDirPath}`);
console.log(`Using REPO_NAME: ${REPO_NAME}`);

// 0. Copy .nojekyll file
try {
    if (fs.existsSync(nojekyllSrc)) {
        fs.copyFileSync(nojekyllSrc, nojekyllDest);
        console.log('✓ Copied .nojekyll to build directory.');
    } else {
        console.warn('Warning: .nojekyll not found in dist-fix/. Please create it if needed.');
        // If .nojekyll doesn't exist in source, create it in destination
        fs.writeFileSync(nojekyllDest, ''); // Create an empty .nojekyll file
        console.log('✓ Created empty .nojekyll in build directory.');
    }
} catch (error) {
    console.error('Error copying/creating .nojekyll:', error);
}


// Function to recursively patch files (JS, CSS) within a directory
const patchFiles = (dir) => {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            patchFiles(filePath); // Recurse into subdirectories
        } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.error(`Error reading ${file}:`, err);
                    return;
                }

                let result = data;

                // --- CRITICAL PATCHING LOGIC FOR JS/CSS BUNDLES ---
                // The goal is to prepend REPO_NAME only to known absolute paths
                // that are likely *not* part of other JavaScript regex literals.

                // 1. MOST IMPORTANT: Patch for react-native-vector-icons font paths specifically.
                // This targets the exact confirmed path: /assets/node_modules/.../Feather.ttf
                // It looks for a URL or string that starts exactly with this absolute path
                // and prepends the REPO_NAME. This is the most surgical fix.
                result = result.replace(
                    /(\b(?:url\(['"]?|['"]))(\/assets\/node_modules\/@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/.*?\.ttf)/g,
                    `$1${REPO_NAME}$2`
                );

                // 2. Patch for _expo/static/ paths in JS/CSS (e.g., from _expo/static/js/ or _expo/static/media/)
                // This covers cases like "src='/_expo/static/js/bundle.js'" or "url(/_expo/static/media/asset.png)"
                // We're looking for an absolute path that starts with /_expo/static/
                result = result.replace(
                    /(\b(?:url\(['"]?|['"]))(\/_expo\/static\/)/g,
                    `$1${REPO_NAME}$2`
                );

                // 3. Patch for general /assets/ paths in JS/CSS, excluding the node_modules case (already handled by #1)
                // This looks for absolute paths starting with /assets/ that are NOT followed by node_modules/
                result = result.replace(
                    /(\b(?:url\(['"]?|['"]))(\/assets\/)(?!node_modules\/)/g,
                    `$1${REPO_NAME}$2`
                );

                // --- END IMPORTANT PATCHING LOGIC ---

                if (result !== data) { // Only write if changes were actually made
                    fs.writeFile(filePath, result, 'utf8', (err) => {
                        if (err) console.error(`Error writing ${file}:`, err);
                        else console.log(`${file} patched successfully.`);
                    });
                }
            });
        }
    });
};

// 1. Patch index.html first to ensure <base href> is correct and other direct paths
fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading index.html:', err);
        return;
    }

    let result = data;

    // Ensure <base href> points to the repo name
    // Replace <base href="/"> if it exists
    if (result.includes('<base href="/">')) {
        result = result.replace(
            /<base href="\/">/,
            `<base href="${REPO_NAME}">`
        );
        console.log('index.html base href patched.');
    } else if (!result.includes(`<base href="${REPO_NAME}">`)) {
        // If <base href="/"> doesn't exist and our REPO_NAME isn't there, insert it after <title>
        result = result.replace(
            /(<title>.*?<\/title>)/,
            `$1\n  <base href="${REPO_NAME}">`
        );
        console.log('index.html base href inserted.');
    } else {
        console.log('index.html base href already correct.');
    }

    // Also patch any other absolute paths that might exist directly in index.html for href/src
    // Targets href/src attributes that start with '/', but are NOT 'base' and specifically for favicon or _expo/static or assets/
    result = result.replace(/(href|src)="\/(?!base)(favicon\.ico|_expo\/static\/|assets\/)/g, `$1="${REPO_NAME}$2`);

    fs.writeFile(indexPath, result, 'utf8', (err) => {
        if (err) console.error('Error writing index.html:', err);
        else {
            console.log('Finished processing index.html. Now patching JS/CSS assets.');
            // 2. Then, patch CSS and JS files
            patchFiles(buildDirPath);
        }
    });
});
