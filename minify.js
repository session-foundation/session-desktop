#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Minify all JS files in ts/ directory using Terser
 * Usage: node build/minify.js [--no-mangle] [--keep-console]
 */

const fs = require('fs');
const os = require('os');
const { globSync } = require('glob');
const { minify } = require('terser');

// ANSI colors
const c = code => (process.env.NO_COLOR ? '' : `\x1b[${code}m`);
const green = c(32);
const yellow = c(33);
const dim = c(2);
const reset = c(0);

// Parse CLI args
const args = process.argv.slice(2);
const noMangle = args.includes('--no-mangle');
const keepConsole = args.includes('--keep-console');
const skipMinify = process.env.SKIP_MINIFY === '1';

if (skipMinify) {
  console.log(`${yellow}Skipping minification (SKIP_MINIFY=1)${reset}`);
  process.exit(0);
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  const startTime = Date.now();
  const files = globSync('ts/**/*.js', { ignore: ['ts/**/*.min.js'] });

  if (files.length === 0) {
    console.log(`${yellow}No files found to minify${reset}`);
    return;
  }

  console.log(`${dim}Minifying ${files.length} files...${reset}`);

  let totalInputSize = 0;
  let totalOutputSize = 0;
  let errors = 0;

  /** @type {import('terser').MinifyOptions} */
  const terserOptions = {
    // Electron 34 = Chromium 132, supports ES2024+
    ecma: 2024,
    module: true,
    compress: {
      ecma: 2024,
      passes: 2, // more than 2 passes doesn't seem to improve anything
      dead_code: true,
      drop_debugger: true,
      drop_console: !keepConsole ? ['log', 'debug', 'info'] : false,
      // Aggressive optimizations safe for modern V8
      arrows: true, // Convert functions to arrows where safe
      arguments: true, // Replace arguments[i] with named params
      booleans_as_integers: false, // Keep booleans as booleans (clearer)
      booleans: true,
      collapse_vars: true,
      comparisons: true,
      computed_props: true,
      conditionals: true,
      dead_code: true,
      directives: true,
      evaluate: true,
      expression: false,
      hoist_funs: true,
      hoist_props: true, // Hoist properties from objects
      hoist_vars: false, // Don't hoist vars (can break things)
      if_return: true,
      inline: 3, // Aggressive function inlining
      join_vars: true,
      keep_fnames: noMangle,
      keep_classnames: noMangle,
      loops: true,

      negate_iife: true,
      properties: true, // Rewrite property access
      reduce_funcs: true,
      reduce_vars: true,
      sequences: true,
      side_effects: true, // Drop side-effect-free code
      switches: true,
      toplevel: false, // Don't touch top-level (module exports)
      typeofs: true,
      unsafe_arrows: true, // Safe for Electron
      unsafe_methods: true, // Safe for Electron
      unsafe_proto: true, // Safe for Electron
      unused: true,
    },
    mangle: noMangle
      ? false
      : {
          toplevel: false, // Preserve module exports
          eval: false, // Don't mangle when eval is present
          properties: false, // Don't mangle properties (can break things)
        },
    format: {
      ecma: 2024,
      comments: false,
      webkit: false, // No Safari workarounds needed
      wrap_func_args: false,
    },
  };

  // Process files in parallel with concurrency based on CPU cores
  const CONCURRENCY = os.cpus().length;
  const chunks = [];
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    chunks.push(files.slice(i, i + CONCURRENCY));
  }

  let processed = 0;

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async file => {
        try {
          const inputCode = fs.readFileSync(file, 'utf-8');
          const inputSize = Buffer.byteLength(inputCode, 'utf-8');
          totalInputSize += inputSize;

          const result = await minify(inputCode, terserOptions);

          if (result.code) {
            fs.writeFileSync(file, result.code, 'utf-8');
            const outputSize = Buffer.byteLength(result.code, 'utf-8');
            totalOutputSize += outputSize;
          } else {
            // No output means no change needed
            totalOutputSize += inputSize;
          }
        } catch (err) {
          console.error(`\n${yellow}Failed to minify ${file}: ${err.message}${reset}`);
          errors++;
          // Keep original file, count its size
          try {
            const size = fs.statSync(file).size;
            totalOutputSize += size;
          } catch {
            // Ignore
          }
        } finally {
          processed++;
          process.stdout.write(`\r${dim}Minifying... ${processed}/${files.length}${reset}`);
        }
      })
    );
  }

  // Clear progress line
  process.stdout.write('\r\x1b[K');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const saved = totalInputSize - totalOutputSize;
  const percent = ((saved / totalInputSize) * 100).toFixed(1);

  console.log(
    `${green}Minified ${formatBytes(totalInputSize)} → ${formatBytes(totalOutputSize)} (-${percent}%) [${files.length} files in ${elapsed}s]${reset}`
  );

  if (errors > 0) {
    console.log(`${yellow}${errors} file(s) failed to minify${reset}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
