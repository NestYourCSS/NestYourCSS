import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const binPath = join(__dirname, '..', 'bin', 'nycss.js');

function runCli(args = []) {
  return spawnSync(process.execPath, [binPath, ...args], {
    encoding: 'utf-8',
    cwd: process.cwd(),
  });
}

const INPUT_CSS = '.a { color: red; }\n.a .b { color: blue; }\n';

describe('@nycss/cli', () => {
  let tmpDir;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nycss-cli-test-'));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should output to stdout when no -o is given', () => {
    const inputFile = join(tmpDir, 'stdout.css');
    writeFileSync(inputFile, 'a { color: red; }');
    const result = runCli([inputFile]);
    assert.strictEqual(result.status, 0);
    assert(result.stdout.includes('color: red'));
  });

  it('should process and write to output file', () => {
    const inputFile = join(tmpDir, 'basic.css');
    const outputFile = join(tmpDir, 'basic-out.css');
    writeFileSync(inputFile, INPUT_CSS);

    const result = runCli([inputFile, '-o', outputFile]);
    assert.strictEqual(result.status, 0);

    const output = readFileSync(outputFile, 'utf-8');
    assert(output.includes('color: red'));
    assert(output.includes('color: blue'));
  });

  it('should support --mode minify', () => {
    const inputFile = join(tmpDir, 'minify.css');
    const outputFile = join(tmpDir, 'minify-out.css');
    writeFileSync(inputFile, INPUT_CSS);

    const result = runCli([inputFile, '-o', outputFile, '-m', 'minify']);
    assert.strictEqual(result.status, 0);

    const output = readFileSync(outputFile, 'utf-8');
    assert(output.includes('color:red'));
    assert(!output.includes('\n'));
  });

  it('should support --mode denest', () => {
    const inputFile = join(tmpDir, 'denest.css');
    const outputFile = join(tmpDir, 'denest-out.css');
    writeFileSync(inputFile, '.a { color: red; }\n.a .b { color: blue; }');

    const result = runCli([inputFile, '-o', outputFile, '-m', 'denest']);
    assert.strictEqual(result.status, 0);

    const output = readFileSync(outputFile, 'utf-8');
    assert(output.includes('.a'));
    assert(output.includes('.b'));
  });

  it('should support --mode beautify', () => {
    const inputFile = join(tmpDir, 'beautify.css');
    const outputFile = join(tmpDir, 'beautify-out.css');
    writeFileSync(inputFile, 'a{color:red}');

    const result = runCli([inputFile, '-o', outputFile, '-m', 'beautify']);
    assert.strictEqual(result.status, 0);

    const output = readFileSync(outputFile, 'utf-8');
    assert(output.includes('color: red'));
    assert(output.includes('{'));
    assert(output.includes('}'));
  });

  it('should support --indent tab', () => {
    const inputFile = join(tmpDir, 'indent-tab.css');
    const outputFile = join(tmpDir, 'indent-tab-out.css');
    writeFileSync(inputFile, '.a { color: red; }\n.a .b { color: blue; }');

    const result = runCli([inputFile, '-o', outputFile, '-i', 'tab']);
    assert.strictEqual(result.status, 0);

    const output = readFileSync(outputFile, 'utf-8');
    assert(output.includes('\tcolor:'));
  });

  it('should support --indent 2', () => {
    const inputFile = join(tmpDir, 'indent-2.css');
    const outputFile = join(tmpDir, 'indent-2-out.css');
    writeFileSync(inputFile, '.a { color: red; }\n.a .b { color: blue; }');

    const result = runCli([inputFile, '-o', outputFile, '-i', '2']);
    assert.strictEqual(result.status, 0);

    const output = readFileSync(outputFile, 'utf-8');
    assert(output.includes('  color:'));
  });

  it('should support --no-comments', () => {
    const inputFile = join(tmpDir, 'comments.css');
    const outputFile = join(tmpDir, 'comments-out.css');
    writeFileSync(inputFile, '/* a comment */\na { color: red; }');

    const result = runCli([inputFile, '-o', outputFile, '--no-comments']);
    assert.strictEqual(result.status, 0);

    const output = readFileSync(outputFile, 'utf-8');
    assert(!output.includes('comment'));
    assert(output.includes('color: red'));
  });

  it('should support --out-dir with multiple files', () => {
    const subDir = join(tmpDir, 'src');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, 'a.css'), '.x { color: red; }');
    writeFileSync(join(subDir, 'b.css'), '.y { color: blue; }');

    const outDir = join(tmpDir, 'dist');
    const result = runCli([join(subDir, '*.css'), '--out-dir', outDir]);
    assert.strictEqual(result.status, 0);

    assert(join(outDir, 'a.css') !== undefined);
    assert(join(outDir, 'b.css') !== undefined);

    const outA = readFileSync(join(outDir, 'a.css'), 'utf-8');
    const outB = readFileSync(join(outDir, 'b.css'), 'utf-8');
    assert(outA.includes('color: red'));
    assert(outB.includes('color: blue'));
  });

  it('should support --out as directory with glob', () => {
    const subDir = join(tmpDir, 'globdir', 'src');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, 'a.css'), '.x { color: red; }');
    writeFileSync(join(subDir, 'b.css'), '.y { color: blue; }');

    const outDir = join(tmpDir, 'globdir', 'dist');
    const result = runCli([join(tmpDir, 'globdir', 'src', '*.css'), '--out', outDir]);
    assert.strictEqual(result.status, 0);

    const outA = readFileSync(join(outDir, 'a.css'), 'utf-8');
    const outB = readFileSync(join(outDir, 'b.css'), 'utf-8');
    assert(outA.includes('color: red'));
    assert(outB.includes('color: blue'));
  });

  it('should reject invalid --mode', () => {
    const inputFile = join(tmpDir, 'invalid-mode.css');
    writeFileSync(inputFile, 'a { color: red; }');
    const result = runCli([inputFile, '-m', 'invalid']);
    assert(result.status !== 0);
    assert(result.stderr.includes('Invalid mode'));
  });

  it('should support --depth to limit nesting', () => {
    const inputFile = join(tmpDir, 'depth.css');
    const outputFile = join(tmpDir, 'depth-out.css');
    writeFileSync(inputFile, '.a { color: red; }\n.a .b { color: blue; }\n.a .b .c { color: green; }');

    const result = runCli([inputFile, '-o', outputFile, '-d', '1']);
    assert.strictEqual(result.status, 0);

    const output = readFileSync(outputFile, 'utf-8');
    assert(output.includes('.a'));
    assert(output.includes('.b'));
    assert(output.includes('.c'));
    const nestingLevels = output.split('\n').filter(l => l.includes('{')).length;
    assert(nestingLevels >= 2, 'Should have at least 2 rules');
  });

  it('should reject negative --depth', () => {
    const inputFile = join(tmpDir, 'neg-depth.css');
    writeFileSync(inputFile, 'a { color: red; }');
    const result = runCli([inputFile, '--depth=-1']);
    assert(result.status !== 0);
    assert((result.stderr + result.stdout).includes('non-negative'));
  });

  it('should support --base for output directory structure', () => {
    const srcDir = join(tmpDir, 'base-test', 'components');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'btn.css'), '.btn { color: red; }');

    const outDir = join(tmpDir, 'base-test', 'out');
    const result = runCli([
      join(tmpDir, 'base-test', 'components', 'btn.css'),
      '--out-dir', outDir,
      '--base', join(tmpDir, 'base-test'),
    ]);
    assert.strictEqual(result.status, 0);

    const expected = join(outDir, 'components', 'btn.css');
    const output = readFileSync(expected, 'utf-8');
    assert(output.includes('color: red'));
  });

  it('should process CSS from stdin when piped', () => {
    const inputCSS = 'a { color: red; }';
    const result = spawnSync(process.execPath, [binPath, '--mode', 'minify'], {
      input: inputCSS,
      encoding: 'utf-8',
    });
    assert.strictEqual(result.status, 0);
    assert(result.stdout.includes('color:red'));
  });

  it('should reject both --out and --out-dir', () => {
    const inputFile = join(tmpDir, 'both-flags.css');
    writeFileSync(inputFile, 'a { color: red; }');
    const result = runCli([inputFile, '-o', 'out.css', '--out-dir', 'outdir']);
    assert(result.status !== 0);
    assert(result.stderr.includes('Use either'));
  });

  it('should print help with --help', () => {
    const result = runCli(['--help']);
    assert.strictEqual(result.status, 0);
    assert(result.stdout.includes('nycss'));
  });

  it('should exit non-zero with no matching files', () => {
    const nonExistent = join(tmpDir, 'nonexistent', '*.css');
    const result = runCli([nonExistent]);
    assert(result.status !== 0);
  });
});
