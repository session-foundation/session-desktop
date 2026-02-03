/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { SourceMapConsumer } = require('source-map');
const { globSync } = require('glob');

// Project root directory (where babel.config.js lives)
const PROJECT_ROOT = __dirname;
const fileFilter = process.env.SESSION_RC_FILE_FILTER;
const allowErrors = process.env.SESSION_RC_ALLOW_ERRORS;

// File patterns for babel
const babelInclude = 'dist/ts/**/*.js';
const babelIgnore = ['dist/ts/test/**', 'dist/ts/svgs/**'];

// NOTE: [react-compiler] we are telling the compiler to not attempt
// to compile these files in the babel config as they are highly
// complex and have a lot of very fine tuned callbacks and useEffect
// logic, so it's probably not worth trying to refactor at this stage.
const filesIgnoredByReactCompiler = new Set(
  [
    'dist/ts/components/conversation/composition/CompositionTextArea.js',
    'dist/ts/components/conversation/SessionStagedLinkPreview.js',
  ].map(f => path.join(PROJECT_ROOT, f))
);

// ANSI color codes
const c = code => (process.env.NO_COLOR ? '' : `\x1b[${code}m`);
const colors = {
  reset: c(0),
  bright: c(1),
  dim: c(2),
  black: c(30),
  red: c(31),
  green: c(32),
  yellow: c(33),
  blue: c(34),
  magenta: c(35),
  cyan: c(36),
  white: c(37),
  bgRed: c(41),
  bgYellow: c(43),
};

// Cache for source map consumers
const sourceMapCache = new Map();

// Number of lines to show before/after error
const CONTEXT_LINES = 2;

// Collect all errors grouped by file
const errorsByFile = new Map();
const skippedFiles = new Set();
const filenameMap = new Map();
const pendingPromises = [];

// File size tracking - measure all js files at startup
function getTotalSize() {
  const files = globSync('dist/ts/**/*.js', {
    cwd: PROJECT_ROOT,
    ignore: babelIgnore,
  });
  let total = 0;
  for (const file of files) {
    try {
      total += fs.statSync(path.join(PROJECT_ROOT, file)).size;
    } catch {
      // Skip files that don't exist
    }
  }
  return { total, count: files.length };
}

const initialStats = getTotalSize();
const startTime = Date.now();

// Progress tracking
let filesProcessed = 0;
const totalFiles = initialStats.count;

function updateProgress() {
  filesProcessed++;
  process.stdout.write(
    `\r${colors.dim}Compiling... ${filesProcessed}/${totalFiles}${colors.reset}`
  );
}

function clearProgress() {
  process.stdout.write('\r\x1b[K');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function printSizeSummary() {
  clearProgress();

  const finalStats = getTotalSize();
  const inputSize = initialStats.total;
  const outputSize = finalStats.total;

  if (inputSize === 0) return;

  const diff = outputSize - inputSize;
  const percent = ((diff / inputSize) * 100).toFixed(1);
  const sign = diff >= 0 ? '+' : '';
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(
    `${colors.green}Compiled ${formatBytes(inputSize)} → ${formatBytes(outputSize)} (${sign}${percent}%) [${finalStats.count} files in ${elapsed}s]${colors.reset}`
  );
}

function resolveFilename(filename) {
  const resultName = filenameMap.get(filename);
  if (resultName) {
    return resultName;
  }

  const relativeFilename = path.relative(PROJECT_ROOT, filename);
  filenameMap.set(filename, relativeFilename);
  return relativeFilename;
}

async function getOriginalLocation(jsFile, line, column) {
  try {
    const mapFile = `${jsFile}.map`;

    if (!fs.existsSync(mapFile)) {
      return null;
    }

    let consumer = sourceMapCache.get(mapFile);
    if (!consumer) {
      const rawSourceMap = JSON.parse(fs.readFileSync(mapFile, 'utf-8'));
      consumer = await new SourceMapConsumer(rawSourceMap);
      sourceMapCache.set(mapFile, consumer);
    }

    const original = consumer.originalPositionFor({ line, column });
    return original.source ? original : null;
  } catch (err) {
    return null;
  }
}

function getSourceContent(jsFile) {
  try {
    const mapFile = `${jsFile}.map`;
    if (!fs.existsSync(mapFile)) {
      return null;
    }
    const rawSourceMap = JSON.parse(fs.readFileSync(mapFile, 'utf-8'));
    if (rawSourceMap.sourcesContent && rawSourceMap.sourcesContent[0]) {
      return {
        content: rawSourceMap.sourcesContent[0],
        sourceName: rawSourceMap.sources[0],
      };
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function processErrorInternal(filename, event) {
  const errorLoc = event.detail?.options?.loc;
  const fnLoc = event.fnLoc;
  const reason = event.detail?.options?.reason || 'Unknown error';
  const category = event.detail?.options?.category || 'Unknown';

  const errorData = {
    reason,
    category,
    lines: [],
  };

  if (!fnLoc || !errorLoc) {
    errorData.lines.push(`  ${colors.yellow}Reason:${colors.reset} [${category}] ${reason}`);
    return errorData;
  }

  // Try to get original TS source from source map
  const sourceData = getSourceContent(filename);
  let source;
  let sourceName;

  if (sourceData) {
    source = sourceData.content;
    sourceName = sourceData.sourceName;
  } else {
    source = fs.readFileSync(filename, 'utf-8');
    sourceName = filename;
  }

  const lines = source.split('\n');

  // Map JS locations to TS locations
  let errStartLine = errorLoc.start.line;
  let errEndLine = errorLoc.end.line;
  let errColStart = errorLoc.start.column;
  let errColEnd = errorLoc.end.column;

  if (sourceData) {
    const errStartOrig = await getOriginalLocation(
      filename,
      errorLoc.start.line,
      errorLoc.start.column
    );
    const errEndOrig = await getOriginalLocation(filename, errorLoc.end.line, errorLoc.end.column);

    if (errStartOrig) {
      errStartLine = errStartOrig.line;
      errColStart = errStartOrig.column;
    }
    if (errEndOrig) {
      errEndLine = errEndOrig.line;
      errColEnd = errEndOrig.column;
    }
  }

  // Validate line numbers are within bounds
  const maxLine = lines.length;
  errStartLine = Math.max(1, Math.min(errStartLine, maxLine));
  errEndLine = Math.max(1, Math.min(errEndLine, maxLine));

  // Show context around the error
  const contextStart = Math.max(0, errStartLine - CONTEXT_LINES - 1);
  const contextEnd = Math.min(lines.length, errEndLine + CONTEXT_LINES);

  errorData.sourceName = sourceName;
  errorData.errStartLine = errStartLine;
  errorData.errColStart = errColStart;
  errorData.errColEnd = errColEnd;

  errorData.lines.push(`  ${colors.yellow}Reason:${colors.reset} [${category}] ${reason}`);
  errorData.lines.push(
    `  ${colors.yellow}Source:${colors.reset} ${colors.dim}${sourceName}${colors.reset} line ${errStartLine}, columns ${errColStart}-${errColEnd}`
  );

  // Only show source context if we have valid lines to show
  if (contextEnd > contextStart && lines.length > 0) {
    errorData.lines.push(`  ${colors.dim}${'─'.repeat(60)}${colors.reset}`);

    for (let i = contextStart; i < contextEnd; i++) {
      const lineNum = i + 1;
      const lineNumStr = lineNum.toString().padStart(4, ' ');
      const line = lines[i] ?? '';

      const isErrorLine = lineNum >= errStartLine && lineNum <= errEndLine;

      if (isErrorLine) {
        const gutter = `${colors.bgRed}${colors.black} ${lineNumStr} ${colors.reset}`;

        if (errColStart !== null && errColEnd !== null && lineNum === errStartLine) {
          // Clamp column values to line length
          const safeColStart = Math.min(errColStart, line.length);
          const safeColEnd = Math.min(errColEnd, line.length);

          const before = line.substring(0, safeColStart);
          const highlight = line.substring(safeColStart, safeColEnd);
          const after = line.substring(safeColEnd);

          if (highlight.length > 0) {
            errorData.lines.push(
              `  ${gutter} ${before}${colors.bgYellow}${colors.black}${highlight}${colors.reset}${after}`
            );

            const underline =
              ' '.repeat(safeColStart) + '^'.repeat(Math.max(1, safeColEnd - safeColStart));
            errorData.lines.push(
              `  ${colors.dim}      ${colors.reset} ${colors.red}${underline}${colors.reset}`
            );
          } else {
            // No highlight range, just show the line in red
            errorData.lines.push(`  ${gutter} ${colors.red}${line}${colors.reset}`);
          }
        } else {
          errorData.lines.push(`  ${gutter} ${colors.red}${line}${colors.reset}`);
        }
      } else {
        const gutter = `${colors.dim} ${lineNumStr} ${colors.reset}`;
        errorData.lines.push(`  ${gutter} ${line}`);
      }
    }

    errorData.lines.push(`  ${colors.dim}${'─'.repeat(60)}${colors.reset}`);
  } else {
    // No source context available
    errorData.lines.push(
      `  ${colors.dim}(source context not available - line ${errStartLine} may be out of range for file with ${lines.length} lines)${colors.reset}`
    );
  }

  return errorData;
}

async function processError(filename, event) {
  const errorData = await processErrorInternal(filename, event);
  if (!errorsByFile.has(filename)) {
    errorsByFile.set(filename, []);
  }
  errorsByFile.get(filename).push(errorData);
}

function printAllErrors() {
  console.log(`\n${colors.red}${colors.bright}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.red}${colors.bright}  REACT COMPILER ERRORS SUMMARY${colors.reset}`);
  console.log(`${colors.red}${colors.bright}${'═'.repeat(70)}${colors.reset}`);

  let totalErrors = 0;

  const errorsByFileArray = [];
  errorsByFile.forEach((errors, filename) => {
    const relativeFilename = resolveFilename(filename);
    totalErrors += errors.length;
    errorsByFileArray.push({ errors, filename: relativeFilename });
  });

  errorsByFileArray.sort((a, b) => b.errors.length - a.errors.length);

  if (fileFilter) {
    console.log(
      `${colors.red} File filter specified, filtering output for: ${fileFilter} ${colors.reset}`
    );
  }

  let hiddenFiles = 0;

  errorsByFileArray.forEach(({ errors, filename }) => {
    if (fileFilter && !filename.includes(fileFilter)) {
      hiddenFiles++;
      return;
    }
    console.log(
      `\n${colors.cyan}${colors.bright}📁 ${filename}${colors.reset} ${colors.dim}(${errors.length} error${errors.length > 1 ? 's' : ''})${colors.reset}`
    );
    console.log(`${colors.dim}${'─'.repeat(70)}${colors.reset}`);
    errors.forEach((error, index) => {
      if (errors.length > 1) {
        console.log(`\n  ${colors.magenta}Error ${index + 1}:${colors.reset}`);
      }
      error.lines.forEach(line => console.log(line));
    });
  });

  const logTotals = () => {
    console.log(`\n${colors.red}${colors.bright}${'═'.repeat(70)}${colors.reset}`);
    console.log(
      `${colors.red}${colors.bright}  Total: ${totalErrors} error${totalErrors > 1 ? 's' : ''} in ${errorsByFile.size} file${errorsByFile.size > 1 ? 's' : ''}${colors.reset}`
    );
    console.log(`${colors.red}${colors.bright}${'═'.repeat(70)}${colors.reset}\n`);
  };

  console.log(
    `${colors.red} ${errorsByFile.size} files could not be compiled with the react compiler: ${colors.reset}`
  );
  errorsByFileArray.forEach(({ filename, errors }) =>
    console.log(`  - (${errors.length}) ${colors.red}${colors.bright}${filename}${colors.reset}`)
  );
  logTotals();
  console.log(
    `${colors.red} Babel compilation complete with react compiler errors. Note: react compiler errors mean the file was not compiled with the react compiler, so is left in the same state it was in before compilation. ${colors.reset}\n`
  );

  if (hiddenFiles > 0) {
    console.log(
      `${colors.red} ${hiddenFiles} files were hidden from the compiler output because of the filter: ${fileFilter} ${colors.reset}`
    );
  }
}

function printSkippedFiles() {
  const multiple = skippedFiles.size > 1;
  console.log(
    `${colors.yellow}${skippedFiles.size} file${multiple ? 's were' : ' was'} skipped by the react compiler based on the config: ${colors.reset}`
  );
  skippedFiles.forEach(filename => {
    const resolvedFileName = resolveFilename(filename);
    console.log(`${colors.yellow} - ${resolvedFileName} ${colors.reset}`);
  });
}

async function handleExit() {
  await Promise.all(pendingPromises);
  printSizeSummary();
  if (errorsByFile.size > 0) {
    printAllErrors();
  } else {
    console.log(
      `${colors.green}${totalFiles - skippedFiles.size} files were successfully parsed by the React Compiler ${colors.reset}`
    );
  }

  if (skippedFiles.size) {
    printSkippedFiles();
  }

  if (errorsByFile.size > 0) {
    if (allowErrors) {
      console.log(
        `${colors.red}SESSION_RC_ALLOW_ERRORS was enabled, the compiler will report no errors and the build will continue! ${colors.reset}`
      );
    } else {
      process.exit(1);
    }
  }
}

let cleanupRegistered = false;
function registerCleanup() {
  if (cleanupRegistered) {
    return;
  }
  cleanupRegistered = true;

  process.on('beforeExit', () => {
    void handleExit();
  });
}

// Always register cleanup to print size summary
registerCleanup();

const packageJson = require('./package.json');

const electron = packageJson.devDependencies.electron;
if (!electron) {
  throw new Error('Unable to find electron version in package.json devDependencies');
}
console.log(`Babel is targeting Electron ${electron}`);

const react = packageJson.dependencies.react;
if (!react) {
  throw new Error('Unable to find react version in package.json dependencies');
}

const reactTargetMajor = react.split('.')[0];
if (!reactTargetMajor || Number.isNaN(Number.parseInt(reactTargetMajor))) {
  throw new Error(`Unable to parse react version from package.json dependencies: "${react}"`);
}

console.log(`React compiler is targeting React ${reactTargetMajor}`);

/** @type {import('@types/babel__core').TransformOptions} */
module.exports = {
  targets: {
    electron,
  },
  presets: [
    [
      '@babel/preset-env',
      {
        modules: 'commonjs',
        targets: {
          electron,
        },
        bugfixes: true, // Use smaller transforms
        exclude: [
          // Exclude transforms Electron doesn't need
          'transform-typeof-symbol',
          'transform-regenerator',
          'transform-async-to-generator',
        ],
      },
    ],
  ],
  plugins: [
    // Progress tracking plugin
    function progressPlugin() {
      return {
        post() {
          updateProgress();
        },
      };
    },
    // Add data-component attribute to styled-components for debugging
    require.resolve('./babel-plugins/styled-components-data-component'),
    [
      require.resolve('babel-plugin-react-compiler'),
      {
        target: reactTargetMajor,
        sources: filename => {
          // Skip specific file(s) from React Compiler
          if (filesIgnoredByReactCompiler.has(filename)) {
            skippedFiles.add(filename);
            registerCleanup();
            return false;
          }
          return true;
        },
        logger: {
          logEvent(filename, event) {
            if (event.kind === 'CompileError') {
              registerCleanup();
              pendingPromises.push(processError(filename, event));
            }
          },
        },
      },
    ],
  ],
  only: [babelInclude],
  ignore: babelIgnore,
};
