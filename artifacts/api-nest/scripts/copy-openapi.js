const { copyFileSync, mkdirSync, rmSync, existsSync, statSync } = require('node:fs');
const { join, dirname } = require('node:path');

const apiNestRoot = join(__dirname, '..');
const source = join(apiNestRoot, '../../lib/api-spec/openapi.yaml');

function ensureDir(dir) {
  if (existsSync(dir) && !statSync(dir).isDirectory()) {
    rmSync(dir);
  }
  mkdirSync(dir, { recursive: true });
}

function copySpec(target) {
  ensureDir(dirname(target));
  copyFileSync(source, target);
  console.log(`Copied OpenAPI spec → ${target}`);
}

copySpec(join(apiNestRoot, 'openapi/openapi.yaml'));
copySpec(join(apiNestRoot, 'dist/openapi/openapi.yaml'));
