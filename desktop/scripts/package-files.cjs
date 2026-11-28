// Keep a single complete file matcher per target. Mixing root and platform
// matchers can copy the build output and tests back into the application.
const common = [
  "**/*",
  "!dist/**",
  "!vendor/everything-es/**",
  "!vendor/everything-engine/**",
  "!.agent/**",
  "!.github/**",
  "!android/**",
  "!mobile-harness.js",
  "!capacitor.config.json",
  "!tests/**",
  "!test-results{,-*}/**",
  "!playwright-report/**",
  "!src/icons/frames/**",
  "!.gemini/**",
  "!scripts/**",
  "!docs/**",
  "!playwright.config.*",
  "!src/icons/screenshots/**",
  "!src/icons/app/orbit_banner.png",
  "!node_modules/lucide/dist/{cjs,esm}{,/**/*}",
  "!node_modules/lucide/dist/umd/!(lucide.min.js)",
  "!node_modules/better-sqlite3/{src,deps}{,/**/*}",
  "!node_modules/better-sqlite3/binding.gyp",
  "!node_modules/**/*.js.map",
  "!node_modules/**/*.d.ts",
  "!node_modules/node-addon-api/**/*.{h,gyp,gypi}",
  "!node_modules/emoji-picker-element/custom-elements.json",
];

// better-sqlite3 resolves its prebuild by OS and CPU, and by libc on Linux.
// Its compiled build/Release fallback and JavaScript API are also retained.
function files(binding) {
  return [...common, `!node_modules/better-sqlite3/prebuilds/!(${binding}).node`];
}

module.exports = {
  win: { files: [...files('win32-${arch}'), '!node_modules/bare-*/prebuilds/!(win32-${arch})/**'] },
  mac: { files: files('darwin-${arch}') },
  linux: { files: files('linux-${arch}|linuxmusl-${arch}') },
};
