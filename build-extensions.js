#!/usr/bin/env node

/**
 * SocialMonkey Extension Build System
 *
 * Usage:
 *   node build-extensions.js                 - Build all platforms
 *   node build-extensions.js twitter         - Build specific platform
 *   node build-extensions.js master          - Build master extension (all platforms)
 *   node build-extensions.js --watch         - Watch mode for all platforms
 *   node build-extensions.js twitter --watch - Watch mode for specific platform
 *   node build-extensions.js --clean         - Clean all build directories
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const watchMode = args.includes('--watch');
const cleanMode = args.includes('--clean');
const specificPlatform = args.find(arg => !arg.startsWith('--'));

const platforms = ['twitter', 'facebook', 'instagram', 'tiktok', 'linkedin', 'youtube', 'reddit', 'snapchat'];
const buildDir = 'builds';

// Shared files copied to all builds
const sharedFiles = [
  'config.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'background.js',
  'icons'
];

// Platform-specific advanced features
const advancedFeatures = {
  twitter: ['twitter-followers.js', 'twitter-inspirations.js', 'twitter-reply-tracker.js', 'twitter-advanced.js', 'twitter-automation.js']
};

console.log('🐵 SocialMonkey Extension Builder\n');

// Clean mode
if (cleanMode) {
  console.log('🧹 Cleaning build directories...\n');
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
    console.log('✅ Build directories cleaned!\n');
  } else {
    console.log('ℹ️  No build directories to clean.\n');
  }
  process.exit(0);
}

// Determine which platforms to build
let platformsToBuild = platforms;
if (specificPlatform === 'master') {
  platformsToBuild = ['master'];
} else if (specificPlatform && platforms.includes(specificPlatform)) {
  platformsToBuild = [specificPlatform];
} else if (specificPlatform) {
  console.error(`❌ Unknown platform: ${specificPlatform}`);
  console.log(`Available platforms: ${platforms.join(', ')}, master`);
  process.exit(1);
}

/**
 * Build a single platform extension
 */
function buildPlatform(platform) {
  console.log(`📦 Building ${platform} extension...`);

  const platformBuildDir = path.join(buildDir, platform);

  // Create build directory
  if (!fs.existsSync(platformBuildDir)) {
    fs.mkdirSync(platformBuildDir, { recursive: true });
  }

  // Copy shared files
  sharedFiles.forEach(file => {
    const src = path.join(__dirname, file);
    const dest = path.join(platformBuildDir, file);

    // Skip icons directory - we'll handle platform-specific icons separately
    if (file === 'icons') {
      return;
    }

    if (fs.existsSync(src)) {
      if (fs.lstatSync(src).isDirectory()) {
        copyDir(src, dest);
      } else {
        fs.copyFileSync(src, dest);
      }
    }
  });

  // Copy platform-specific icons
  const platformIconsDir = path.join(__dirname, 'icons', platform);
  const destIconsDir = path.join(platformBuildDir, 'icons');
  if (fs.existsSync(platformIconsDir)) {
    if (!fs.existsSync(destIconsDir)) {
      fs.mkdirSync(destIconsDir, { recursive: true });
    }
    // Copy platform icons
    copyDir(platformIconsDir, destIconsDir);
    // Copy shared logo.svg
    const logoSrc = path.join(__dirname, 'icons', 'logo.svg');
    if (fs.existsSync(logoSrc)) {
      fs.copyFileSync(logoSrc, path.join(destIconsDir, 'logo.svg'));
    }
  } else {
    console.warn(`⚠️  No icons found for ${platform} at ${platformIconsDir}`);
  }

  // Copy manifest (platform-specific or master)
  const manifestSrc = platform === 'master'
    ? path.join(__dirname, 'manifest.json')
    : path.join(__dirname, 'manifests', `${platform}.json`);

  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, path.join(platformBuildDir, 'manifest.json'));
  } else {
    console.warn(`⚠️  No manifest found for ${platform} at ${manifestSrc}, skipping...`);
    return;
  }

  // Create content_scripts directory structure
  const contentScriptsDir = path.join(platformBuildDir, 'content_scripts');

  // Copy shared utils
  const sharedUtilsDir = path.join(contentScriptsDir, 'shared');
  if (!fs.existsSync(sharedUtilsDir)) {
    fs.mkdirSync(sharedUtilsDir, { recursive: true });
  }

  const sharedUtilsSrc = path.join(__dirname, 'content_scripts', 'shared', 'utils.js');
  if (fs.existsSync(sharedUtilsSrc)) {
    fs.copyFileSync(sharedUtilsSrc, path.join(sharedUtilsDir, 'utils.js'));
  }

  if (platform === 'master') {
    // For master build, copy all platform scripts
    platforms.forEach(p => {
      copyPlatformScripts(p, contentScriptsDir);
    });
  } else {
    // For individual platform, copy only that platform's scripts
    copyPlatformScripts(platform, contentScriptsDir);
  }

  console.log(`✅ ${platform} extension built successfully\n`);
}

/**
 * Copy platform-specific scripts
 */
function copyPlatformScripts(platform, contentScriptsDir) {
  const platformScriptDir = path.join(contentScriptsDir, platform);
  if (!fs.existsSync(platformScriptDir)) {
    fs.mkdirSync(platformScriptDir, { recursive: true });
  }

  // Copy main platform script
  const mainScriptSrc = path.join(__dirname, 'content_scripts', platform, `${platform}.js`);
  if (fs.existsSync(mainScriptSrc)) {
    fs.copyFileSync(mainScriptSrc, path.join(platformScriptDir, `${platform}.js`));
  }

  // Copy advanced features if they exist
  const platformAdvanced = advancedFeatures[platform] || [];
  platformAdvanced.forEach(featureFile => {
    const featureSrc = path.join(__dirname, 'content_scripts', platform, featureFile);
    if (fs.existsSync(featureSrc)) {
      fs.copyFileSync(featureSrc, path.join(platformScriptDir, featureFile));
    }
  });
}

/**
 * Copy directory recursively
 */
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Watch mode
 */
function setupWatchMode() {
  console.log('👀 Watch mode enabled - rebuilding on file changes...\n');

  // Try to use chokidar if available, otherwise use fs.watch
  let watcher;
  try {
    const chokidar = require('chokidar');

    const watchPaths = [
      'content_scripts/**/*.js',
      'popup.*',
      'background.js',
      'manifest.json',
      'builds/*/manifest.json'
    ];

    watcher = chokidar.watch(watchPaths, {
      ignored: /builds\/[^\/]+\/content_scripts/, // Ignore built files
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('change', (filePath) => {
      console.log(`\n📝 File changed: ${filePath}`);
      console.log('🔄 Rebuilding...\n');
      platformsToBuild.forEach(buildPlatform);
    });

    console.log('✅ Watching for changes...\n');

  } catch (err) {
    console.warn('⚠️  chokidar not installed. Install it for better watch mode:');
    console.warn('   pnpm install -D chokidar\n');
    console.log('Using basic fs.watch instead...\n');

    // Fallback to basic fs.watch
    const watchDirs = ['content_scripts', '.'];
    watchDirs.forEach(dir => {
      fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (filename && (filename.endsWith('.js') || filename.endsWith('.json') || filename.endsWith('.html') || filename.endsWith('.css'))) {
          console.log(`\n📝 File changed: ${filename}`);
          console.log('🔄 Rebuilding...\n');
          platformsToBuild.forEach(buildPlatform);
        }
      });
    });

    console.log('✅ Watching for changes...\n');
  }
}

// Build extensions
platformsToBuild.forEach(buildPlatform);

console.log('🎉 Build complete!\n');
console.log('📍 Build output: builds/<platform>/\n');

if (!watchMode) {
  console.log('💡 Next steps:');
  console.log('   1. Open Chrome → chrome://extensions/');
  console.log('   2. Enable "Developer mode"');
  console.log('   3. Click "Load unpacked"');
  console.log(`   4. Select: builds/${platformsToBuild[0]}/\n`);
  console.log('🔧 Development tips:');
  console.log('   • Run "pnpm run watch:twitter" for auto-rebuild on changes');
  console.log('   • Run "pnpm run clean" to remove all builds\n');
} else {
  setupWatchMode();
}
