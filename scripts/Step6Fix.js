const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

const signingConfigContent = `
    signingConfigs {
        release {
            storeFile file(findProperty('MYAPP_UPLOAD_STORE_FILE'))
            storePassword findProperty('MYAPP_UPLOAD_STORE_PASSWORD')
            keyAlias findProperty('MYAPP_UPLOAD_KEY_ALIAS')
            keyPassword findProperty('MYAPP_UPLOAD_KEY_PASSWORD')
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            shrinkResources false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
`;
// const signingConfigContent = `
// 	signingConfigs {
// 		release {
// 			storeFile file(MYAPP_UPLOAD_STORE_FILE)
// 			storePassword MYAPP_UPLOAD_STORE_PASSWORD
// 			keyAlias MYAPP_UPLOAD_KEY_ALIAS
// 			keyPassword MYAPP_UPLOAD_KEY_PASSWORD
// 		}
// 	}
// 	buildTypes {
// 		release {
// 			signingConfig signingConfigs.release
// 			minifyEnabled false
// 			shrinkResources false
// 			proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
// 		}
// 	}
// `;

try {
    let content = fs.readFileSync(buildGradlePath, 'utf8');
    let lines = content.split('\n');

    let inAndroidBlock = false;
    let braceLevel = 0;
    let insertionIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim().startsWith('android {')) {
            inAndroidBlock = true;
            braceLevel = 1; // Starting brace of android block
        } else if (inAndroidBlock) {
            // Count braces to find the end of the android block
            for (const char of line) {
                if (char === '{') {
                    braceLevel++;
                } else if (char === '}') {
                    braceLevel--;
                }
            }

            if (braceLevel === 0 && line.trim() === '}') {
                // Found the closing brace of the android block
                insertionIndex = i;
                break;
            }
        }
    }

    if (insertionIndex !== -1) {
        // Insert the content before the closing brace
        lines.splice(insertionIndex, 0, signingConfigContent);
        const newContent = lines.join('\n');
        fs.writeFileSync(buildGradlePath, newContent, 'utf8');
        console.log('build.gradle modified successfully for signing configurations.');
    } else {
        console.error('Error: Could not find the closing brace of the android block in build.gradle.');
        process.exit(1);
    }

} catch (error) {
    console.error('Failed to modify build.gradle:', error);
    process.exit(1);
}