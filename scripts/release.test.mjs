import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const bash = process.env.BASH_PATH ?? 'bash';
const version = '1.2.3';

test('release script in an isolated repository', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'oq-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'work');
  mkdirSync(cwd);
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: join(root, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
  };

  function run(command, args, input) {
    const result = spawnSync(command, args, { cwd, env, input, encoding: 'utf8' });
    if (result.error) throw result.error;
    return result;
  }

  function git(...args) {
    const result = run('git', args);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }

  function write(path, value) {
    writeFileSync(join(cwd, path), value);
  }

  function readJson(path) {
    return JSON.parse(readFileSync(join(cwd, path), 'utf8'));
  }

  for (const dir of ['scripts', 'server', 'openapi', 'web/src/api']) {
    mkdirSync(join(cwd, dir), { recursive: true });
  }

  copyFileSync(new URL('./release.sh', import.meta.url), join(cwd, 'scripts/release.sh'));
  write('server/package.json', '{"name":"test-server","version":"1.0.0"}\n');
  write('server/package-lock.json', '{"name":"test-server","version":"1.0.0","lockfileVersion":3,"packages":{"":{"name":"test-server","version":"1.0.0"}}}\n');
  write('openapi/schema.json', '{"info":{"version":"1.0.0"},"other":{"version":"keep"}}\n');
  write('web/package.json', JSON.stringify({
    version: '0.1.0',
    scripts: { 'gen:api': 'node generate.cjs', 'check:api': 'node generate.cjs --check' },
  }));
  write('web/generate.cjs', `
    const fs = require('node:fs');
    const version = require('../openapi/schema.json').info.version;
    const output = 'src/api/schema.d.ts';
    if (process.argv.includes('--check')) {
      require('node:assert/strict').equal(fs.readFileSync(output, 'utf8'), version);
    } else {
      fs.writeFileSync(output, version);
      if (fs.existsSync('fail')) process.exit(1);
    }
  `);
  write('web/src/api/schema.d.ts', '1.0.0');

  git('init', '-b', 'main');
  git('config', 'user.email', 'release-test@example.invalid');
  git('config', 'user.name', 'Release Test');
  git('add', '.');
  git('commit', '-m', 'fixture');
  git('init', '--bare', join(root, 'remote.git'));
  git('remote', 'add', 'origin', '../remote.git');
  const original = git('rev-parse', 'HEAD');

  function release(argument, input, status) {
    const result = run(bash, ['scripts/release.sh', argument], input);
    assert.equal(result.status, status, result.stdout + result.stderr);
  }

  function unchanged() {
    assert.equal(git('rev-parse', 'HEAD'), original);
    assert.equal(git('status', '--porcelain'), '');
    assert.equal(git('tag'), '');
    assert.equal(git('ls-remote', 'origin'), '');
  }

  await t.test('rejects invalid versions', () => {
    release('1.02.3', '', 1);
    unchanged();
  });

  await t.test('rejects a dirty checkout', () => {
    write('local', 'keep');
    release(version, '', 1);
    assert.equal(git('status', '--porcelain'), '?? local');
    rmSync(join(cwd, 'local'));
    unchanged();
  });

  await t.test('rejects an existing tag', () => {
    git('tag', `v${version}`);
    release(version, '', 1);
    assert.equal(git('rev-parse', `v${version}`), original);
    git('tag', '-d', `v${version}`);
    unchanged();
  });

  await t.test('restores changes when cancelled', () => {
    release(version, 'n\n', 0);
    unchanged();
  });

  await t.test('restores changes after partial generator failure', () => {
    write('.git/info/exclude', '/web/fail\n');
    write('web/fail', '');
    release(version, 'y\ny\n', 1);
    assert.equal(readFileSync(join(cwd, 'web/fail'), 'utf8'), '');
    rmSync(join(cwd, 'web/fail'));
    unchanged();
  });

  await t.test('commits only release files and pushes the tag and main', () => {
    release(version, 'y\ny\n', 0);
    assert.equal(readJson('server/package.json').version, version);
    const lock = readJson('server/package-lock.json');
    assert.equal(lock.version, version);
    assert.equal(lock.packages[''].version, version);
    assert.equal(readJson('openapi/schema.json').info.version, version);
    assert.equal(readJson('openapi/schema.json').other.version, 'keep');
    assert.equal(readJson('web/package.json').version, '0.1.0');
    assert.equal(git('status', '--porcelain'), '');
    assert.deepEqual(git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').split(/\r?\n/), [
      'openapi/schema.json', 'server/package-lock.json', 'server/package.json', 'web/src/api/schema.d.ts',
    ]);
    const head = git('rev-parse', 'HEAD');
    assert.equal(git('rev-parse', `v${version}^{}`), head);
    assert.match(git('ls-remote', 'origin', 'refs/heads/main'), new RegExp(`^${head}\\s`));
    assert.match(git('ls-remote', 'origin', `refs/tags/v${version}^{}`), new RegExp(`^${head}\\s`));
  });
});
