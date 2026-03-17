#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const bump = process.argv[2] ?? 'patch';

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);
  if (type === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
  else if (type === 'minor') { parts[1]++; parts[2] = 0; }
  else { parts[2]++; }
  return parts.join('.');
}

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const newVersion = bumpVersion(manifest.version, bump);
manifest.version = newVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.version = newVersion;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

console.log('NEW_VERSION=' + newVersion);
console.log('MODULE_NAME=' + manifest.name);
