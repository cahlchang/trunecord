#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const versionFile = path.join(ROOT, 'VERSION.txt');
if (!fs.existsSync(versionFile)) {
  console.error('VERSION.txt not found');
  process.exit(1);
}
const version = fs.readFileSync(versionFile, 'utf8').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version string: ${version}`);
  process.exit(1);
}

function writeJSON(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, json + '\n');
}

function updateFile(filePath, transform) {
  const abs = path.join(ROOT, filePath);
  if (!fs.existsSync(abs)) {
    return;
  }
  const original = fs.readFileSync(abs, 'utf8');
  const updated = transform(original);
  if (updated !== original) {
    fs.writeFileSync(abs, updated);
  }
}

// Update extension/manifest.json
const manifestPath = path.join(ROOT, 'extension', 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = version;
  writeJSON(manifestPath, manifest);
}

// Update extension/package.json
const extPackageJsonPath = path.join(ROOT, 'extension', 'package.json');
if (fs.existsSync(extPackageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(extPackageJsonPath, 'utf8'));
  pkg.version = version;
  writeJSON(extPackageJsonPath, pkg);
}

// Update extension/package-lock.json (top-level and packages)
const extPackageLockPath = path.join(ROOT, 'extension', 'package-lock.json');
if (fs.existsSync(extPackageLockPath)) {
  const lock = JSON.parse(fs.readFileSync(extPackageLockPath, 'utf8'));
  lock.version = version;
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = version;
  }
  writeJSON(extPackageLockPath, lock);
}

// Update extension tests referencing version
['extension/test/background.test.js', 'extension/test/integration.test.js'].forEach((file) => {
  const abs = path.join(ROOT, file);
  if (fs.existsSync(abs)) {
    updateFile(file, (content) => content.replace(/version: '([0-9]+\.[0-9]+\.[0-9]+)'/g, `version: '${version}'`));
  }
});

// Update Go constants
updateFile('go-client/internal/constants/constants.go', (content) =>
  content
    .replace(/ExpectedExtensionVersion\s*=\s*"[0-9]+\.[0-9]+\.[0-9]+"/, `ExpectedExtensionVersion       = "${version}"`)
    .replace(/ApplicationVersion\s*=\s*"[0-9]+\.[0-9]+\.[0-9]+"/, `ApplicationVersion       = "${version}"`)
);

// Update README references
updateFile('README.md', (content) =>
  content
    .replace(/v[0-9]+\.[0-9]+\.[0-9]+/g, `v${version}`)
    .replace(/\*\*[0-9]+\.[0-9]+\.[0-9]+\*\*/g, `**${version}**`)
);
updateFile('go-client/README.md', (content) =>
  content
    .replace(/v[0-9]+\.[0-9]+\.[0-9]+/g, `v${version}`)
    .replace(/\*\*[0-9]+\.[0-9]+\.[0-9]+\*\*/g, `**${version}**`)
);

// Update auth-server default version strings
updateFile('auth-server/index.js', (content) => content.replace(/'([0-9]+\.[0-9]+\.[0-9]+)'/g, (match, captured) => {
  if (captured && /^\d+\.\d+\.\d+$/.test(captured)) {
    return `'${version}'`;
  }
  return match;
}));

updateFile('terraform/variables.tf', (content) =>
  content
    .replace(/default\s*=\s*"[0-9]+\.[0-9]+\.[0-9]+"/g, `default     = "${version}"`)
);

updateFile('terraform/terraform.tfvars.example', (content) =>
  content.replace(/"[0-9]+\.[0-9]+\.[0-9]+"/g, `"${version}"`)
);

console.log(`Updated project to version ${version}`);
