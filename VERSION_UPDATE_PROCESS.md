# Version Update Process

## CRITICAL: Platform-Specific Manifests

**DO NOT** only update the root `manifest.json` file when bumping versions!

Each platform has its own manifest file that MUST be updated:

### Twitter Extension
- **File to update**: `manifests/twitter.json`
- **Root manifest.json**: NOT used for Twitter builds
- **Build process**: `build-extensions.js` copies `manifests/twitter.json` → `builds/twitter/manifest.json`

### Other Platforms
- Facebook: `manifests/facebook.json`
- Instagram: `manifests/instagram.json`
- LinkedIn: `manifests/linkedin.json`
- Reddit: `manifests/reddit.json`
- Snapchat: `manifests/snapchat.json`
- TikTok: `manifests/tiktok.json`
- YouTube: `manifests/youtube.json`

## Correct Version Update Workflow

1. Update `manifests/[platform].json` version field
2. Run `node build-extensions.js [platform]`
3. Create zip: `cd builds/[platform]; Compress-Archive -Path * -DestinationPath ../../socialmonkey-[platform]-v[X.Y.Z].zip -Force; cd ../..`
4. Commit and push: `git add .; git commit -m "Update [platform] to version X.Y.Z"; git push`

## Common Mistake
❌ Updating only `manifest.json` (root file) - this does NOT affect platform builds!
✅ Update `manifests/twitter.json` (or the specific platform manifest)

## Why This Matters
Chrome Web Store will reject uploads if the new version number isn't higher than the currently published version.
