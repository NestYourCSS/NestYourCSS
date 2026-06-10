import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname, relative, extname } from 'node:path';
import { cac } from 'cac';
import pc from 'picocolors';
import chokidar from 'chokidar';
import fg from 'fast-glob';
import {
  configureEngine,
  parseCSS,
  beautifyCSS,
  minifyCSS,
  denestCSS,
  renestCSS,
} from '@nycss/engine';

const VALID_MODES = ['nest', 'denest', 'minify', 'beautify'];

function parseIndent(value) {
  if (!value || value === 'tab' || value === 't') return '\t';
  const size = parseInt(value, 10);
  return Number.isFinite(size) && size > 0 ? ' '.repeat(size) : '    ';
}

function resolveOutputPath(filePath, baseDir, outDir) {
  const rel = relative(baseDir, filePath);
  return resolve(outDir, rel);
}

async function resolveOutPath(out, filePaths) {
  const resolved = resolve(out);
  if (filePaths.length === 1) {
    try {
      const s = await stat(resolved);
      if (s.isDirectory()) return { type: 'dir', path: resolved };
    } catch {
      if (extname(resolved)) return { type: 'file', path: resolved };
    }
    if (extname(resolved)) return { type: 'file', path: resolved };
    return { type: 'dir', path: resolved };
  }
  return { type: 'dir', path: resolved };
}

function transformCSS(cssString, opts) {
  configureEngine({
    preserveComments: opts.comments !== false,
    indentChar: opts._indentChar,
    maxDepth: opts.depth !== undefined ? parseInt(opts.depth, 10) : undefined,
  });

  const ast = parseCSS(cssString);

  switch (opts.mode) {
    case 'denest':
      denestCSS(ast);
      break;
    case 'minify':
    case 'beautify':
      break;
    case 'nest':
    default:
      renestCSS(ast);
      break;
  }

  switch (opts.mode) {
    case 'minify':
      return minifyCSS(ast);
    default:
      return beautifyCSS(ast) + '\n';
  }
}

async function processFile(filePath, opts) {
  const css = await readFile(filePath, 'utf-8');
  return transformCSS(css, opts);
}

async function writeOutput(filePath, output, opts) {
  if (!opts._outDest) {
    process.stdout.write(output);
    return;
  }

  if (opts._outDest.type === 'file') {
    await mkdir(dirname(opts._outDest.path), { recursive: true });
    await writeFile(opts._outDest.path, output, 'utf-8');
    console.log(
      pc.green('✓'),
      relative(process.cwd(), filePath),
      pc.dim('→'),
      relative(process.cwd(), opts._outDest.path),
    );
  } else {
    const outPath = resolveOutputPath(filePath, opts._baseDir, opts._outDest.path);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, output, 'utf-8');
    console.log(
      pc.green('✓'),
      relative(process.cwd(), filePath),
      pc.dim('→'),
      relative(process.cwd(), outPath),
    );
  }
}

async function runPipeline(files, opts) {
  for (const filePath of files) {
    try {
      const output = await processFile(filePath, opts);
      await writeOutput(filePath, output, opts);
    } catch (err) {
      console.error(pc.red('✗'), `${filePath}:`, err.message);
    }
  }
}

export async function main() {
  const cli = cac('nycss');

  cli
    .command('[...files]', 'CSS input file(s) or glob pattern(s)')
    .option('-o, --out <path>', 'Output destination (file or directory)')
    .option('--out-dir <dir>', 'Output directory')
    .option('-m, --mode <mode>', 'Processing mode: nest, denest, minify, beautify', { default: 'nest' })
    .option('-d, --depth <level>', 'Max nesting depth (0 for infinite)')
    .option('-i, --indent <size>', 'Indent size (number or "tab")', { default: '4' })
    .option('--no-comments', 'Strip comments from output')
    .option('--base <dir>', 'Base directory for preserving output structure')
    .option('-w, --watch', 'Watch input files for changes')
    .action(async (files, options) => {
      if (!files || files.length === 0) {
        if (!process.stdin.isTTY) {
          let inputCSS = '';
          for await (const chunk of process.stdin) {
            inputCSS += chunk;
          }
          const opts = {
            ...options,
            _indentChar: parseIndent(options.indent),
          };
          const output = transformCSS(inputCSS, opts);
          process.stdout.write(output);
          process.exit(0);
        }
        console.error(pc.red('Error:') + ' No input files specified');
        process.exit(1);
      }

      if (options.out && options.outDir) {
        console.error(pc.red('Error:') + ' Use either --out or --out-dir, not both');
        process.exit(1);
      }

      if (options.mode && !VALID_MODES.includes(options.mode)) {
        console.error(pc.red('Error:') + ` Invalid mode "${options.mode}". Valid modes: ${VALID_MODES.join(', ')}`);
        process.exit(1);
      }

      if (options.depth !== undefined) {
        const d = parseInt(options.depth, 10);
        if (!Number.isFinite(d) || d < 0) {
          console.error(pc.red('Error:') + ' --depth must be a non-negative integer');
          process.exit(1);
        }
      }

      const resolvedFiles = [];
      for (const pattern of files) {
        const normalized = pattern.replace(/\\/g, '/');
        const matches = await fg(normalized, { absolute: true });
        if (matches.length === 0) {
          console.warn(pc.yellow('Warning:') + ` No files matched "${pattern}"`);
        }
        resolvedFiles.push(...matches);
      }

      if (resolvedFiles.length === 0) {
        console.error(pc.red('Error:') + ' No input files found');
        process.exit(1);
      }

      const outDest = options.out
        ? await resolveOutPath(options.out, resolvedFiles)
        : options.outDir
          ? { type: 'dir', path: resolve(options.outDir) }
          : null;

      const opts = {
        ...options,
        _indentChar: parseIndent(options.indent),
        _outDest: outDest,
        _baseDir: options.base ? resolve(options.base) : findBaseDir(resolvedFiles),
      };

      if (opts._outDest && opts._outDest.path) {
        await mkdir(dirname(opts._outDest.path), { recursive: true });
      }

      if (options.watch) {
        console.log(pc.cyan('Watching'), `${resolvedFiles.length} file(s)...`);
        await runPipeline(resolvedFiles, opts);
        const watcher = chokidar.watch(resolvedFiles, {
          persistent: true,
          ignoreInitial: true,
        });
        watcher.on('change', async (changedPath) => {
          console.log(pc.cyan('\nChange:'), relative(process.cwd(), changedPath));
          try {
            const output = await processFile(changedPath, opts);
            await writeOutput(changedPath, output, opts);
          } catch (err) {
            console.error(pc.red('✗'), `${changedPath}:`, err.message);
          }
        });
      } else {
        await runPipeline(resolvedFiles, opts);
      }
    });

  cli.help();
  cli.version('0.1.0');

  try {
    cli.parse(process.argv, { run: false });
    await cli.runMatchedCommand();
  } catch (err) {
    console.error(pc.red('Error:'), err.message);
    process.exit(1);
  }
}

function findBaseDir(paths) {
  if (paths.length === 0) return process.cwd();
  if (paths.length === 1) return dirname(paths[0]);

  const parts = paths.map((p) => resolve(p).split(/[/\\]/));
  let commonLength = parts[0].length;
  for (let i = 1; i < parts.length; i++) {
    let j = 0;
    while (
      j < commonLength &&
      j < parts[i].length &&
      parts[i][j].toLowerCase() === parts[0][j].toLowerCase()
    ) {
      j++;
    }
    commonLength = j;
  }
  return parts[0].slice(0, commonLength).join('/');
}
