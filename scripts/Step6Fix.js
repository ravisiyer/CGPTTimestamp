const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
// const buildGradlePath = "./build.gradle.before-fix.txt"

// Content for the release signingConfig to be inserted
const releaseSigningConfig = `
        release {
            storeFile file(findProperty('MYAPP_UPLOAD_STORE_FILE'))
            storePassword findProperty('MYAPP_UPLOAD_STORE_PASSWORD')
            keyAlias findProperty('MYAPP_UPLOAD_KEY_ALIAS')
            keyPassword findProperty('MYAPP_UPLOAD_KEY_PASSWORD')
        }`; // Note: No trailing newline here, will be added by splice if needed.

try {
    let content = fs.readFileSync(buildGradlePath, 'utf8');
    let lines = content.split('\n');

    let inSigningConfigsBlock = false;
    let signingConfigsBraceLevel = 0;
    let insertionPointFound = false;

    let inBuildTypesBlock = false;
    let buildTypesBraceLevel = 0;
    let modifiedReleaseBuildType = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // --- Logic for modifying signingConfigs block ---
        if (line.trim().startsWith('signingConfigs {') && !inSigningConfigsBlock) {
            inSigningConfigsBlock = true;
            signingConfigsBraceLevel = 1;
            // Look for 'debug {' to insert after it, or just before the closing brace if debug is not found
        } else if (inSigningConfigsBlock) {
            for (const char of line) {
                if (char === '{') {
                    signingConfigsBraceLevel++;
                } else if (char === '}') {
                    signingConfigsBraceLevel--;
                }
            }

            if (signingConfigsBraceLevel === 1 && line.trim().startsWith('debug {')) {
                // Found the debug block, find its closing brace to insert after it
                let debugBlockEndIndex = -1;
                let innerBraceLevel = 1;
                for (let j = i + 1; j < lines.length; j++) {
                    const innerLine = lines[j];
                    for (const char of innerLine) {
                        if (char === '{') innerBraceLevel++;
                        else if (char === '}') innerBraceLevel--;
                    }
                    if (innerBraceLevel === 0) {
                        debugBlockEndIndex = j;
                        break;
                    }
                }
                if (debugBlockEndIndex !== -1) {
                    lines.splice(debugBlockEndIndex + 1, 0, '\n' + releaseSigningConfig + '\n'); // Insert after debug block
                    insertionPointFound = true;
                    inSigningConfigsBlock = false; // Done with this block
                }
            } else if (signingConfigsBraceLevel === 0 && line.trim() === '}' && !insertionPointFound) {
                // If we reach the end of signingConfigs block and haven't inserted (e.g., no debug block), insert before closing brace
                lines.splice(i, 0, releaseSigningConfig + '\n');
                insertionPointFound = true;
                inSigningConfigsBlock = false; // Done with this block
            }
        }


        // --- Logic for modifying buildTypes block (release) ---
        if (line.trim().startsWith('buildTypes {') && !inBuildTypesBlock) {
            inBuildTypesBlock = true;
            buildTypesBraceLevel = 1;
        } else if (inBuildTypesBlock) {
            for (const char of line) {
                if (char === '{') {
                    buildTypesBraceLevel++;
                } else if (char === '}') {
                    buildTypesBraceLevel--;
                }
            }

            if (buildTypesBraceLevel === 2 && line.trim().startsWith('release {')) { // Found release block inside buildTypes
                let releaseBlockEndIndex = -1;
                let innerBraceLevel = 1;
                for (let j = i + 1; j < lines.length; j++) {
                    const innerLine = lines[j];
                    for (const char of innerLine) {
                        if (char === '{') innerBraceLevel++;
                        else if (char === '}') innerBraceLevel--;
                    }
                    if (innerBraceLevel === 0) {
                        releaseBlockEndIndex = j;
                        break;
                    }
                }

                if (releaseBlockEndIndex !== -1) {
                    for (let k = i; k < releaseBlockEndIndex; k++) {
                        if (lines[k].includes('signingConfig signingConfigs.debug')) {
                            lines[k] = lines[k].replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release');
                            modifiedReleaseBuildType = true;
                            console.log('Modified release buildType signingConfig successfully.');
                            break; // Exit inner loop once modified
                        }
                    }
                }
            }

            if (buildTypesBraceLevel === 0 && line.trim() === '}') {
                inBuildTypesBlock = false; // Exit the block
            }
        }
    }

    if (!insertionPointFound) {
        console.error('Error: Could not find a suitable insertion point for release signingConfigs.');
        process.exit(1);
    }
    if (!modifiedReleaseBuildType) {
        console.warn('Warning: Could not find or modify the signingConfig for the existing release buildType. Please check manually.');
    }

    const newContent = lines.join('\n');
    fs.writeFileSync(buildGradlePath, newContent, 'utf8');
    console.log('build.gradle modification completed.');

} catch (error) {
    console.error(`Failed to modify build.gradle: ${error.message}`);
    process.exit(1);
}