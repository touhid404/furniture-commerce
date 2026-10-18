import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { Ajv2020 } from 'ajv/dist/2020.js';

const root = resolve('.');
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]);
}
const docs = [resolve('README.md'), resolve('CONTRIBUTING.md'), resolve('SECURITY.md'), resolve('CHANGELOG.md'), ...files(resolve('docs')).filter((p) => p.endsWith('.md'))];
let checkedLinks = 0;
for (const path of docs) {
  const text = readFileSync(path, 'utf8');
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^(https?:|mailto:|codex:)/.test(target)) continue;
    assert.ok(existsSync(resolve(dirname(path), decodeURIComponent(target))), `Broken link in ${path.slice(root.length + 1)}: ${target}`);
    checkedLinks++;
  }
}
const schema = JSON.parse(readFileSync('docs/config/store.schema.json', 'utf8'));
const validate = new Ajv2020({ allErrors: true }).compile(schema);
for (const path of ['config/stores/default.json', 'docs/config/store.example.json']) {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(validate(value), `${path}: ${JSON.stringify(validate.errors)}`);
}
const api = JSON.parse(readFileSync('docs/contracts/openapi.json', 'utf8'));
let refs = 0;
function visit(value) {
  if (!value || typeof value !== 'object') return;
  if (value.$ref) {
    assert.ok(value.$ref.startsWith('#/'), 'Contract references must be local');
    let target = api;
    for (const key of value.$ref.slice(2).split('/')) target = target?.[key.replace(/~1/g, '/').replace(/~0/g, '~')];
    assert.ok(target, `Unresolved OpenAPI reference ${value.$ref}`); refs++;
  }
  Object.values(value).forEach(visit);
}
visit(api);
const operationIds = [];
for (const [path, item] of Object.entries(api.paths)) {
  for (const [method, op] of Object.entries(item)) {
    assert.ok(op.responses && op.operationId, `${method} ${path} missing contract fields`);
    operationIds.push(op.operationId);
    for (const match of path.matchAll(/\{([^}]+)\}/g)) {
      assert.ok(op.parameters?.some((p) => p.name === match[1] && p.in === 'path' && p.required), `${path} missing path parameter`);
    }
  }
}
assert.equal(new Set(operationIds).size, operationIds.length, 'Operation IDs must be unique');
assert.ok(existsSync('docs/deliverables/Furniture-Commerce-Specification.docx'), 'Editable specification missing');
console.log(`PASS ${docs.length} Markdown documents and ${checkedLinks} local links`);
console.log('PASS both JSON profiles against draft 2020-12 schema');
console.log(`PASS ${operationIds.length} OpenAPI operations and ${refs} local schema references`);
console.log('PASS editable specification exists');
