/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { SourceMapConsumer } = require('source-map');

const debug = process.env.SESSION_RC_DEBUG;
const fileFilter = process.env.SESSION_RC_FILE_FILTER;

// Project root directory (where babel.config.js lives)
const PROJECT_ROOT = __dirname;

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
const pendingPromises = [];

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
  if (errorsByFile.size === 0) {
    return;
  }

  console.log(`\n${colors.red}${colors.bright}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.red}${colors.bright}  REACT COMPILER ERRORS SUMMARY${colors.reset}`);
  console.log(`${colors.red}${colors.bright}${'═'.repeat(70)}${colors.reset}`);

  let totalErrors = 0;

  const errorsByFileArray = [];
  errorsByFile.forEach((errors, filename) => {
    const relativeFilename = path.relative(PROJECT_ROOT, filename);
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

async function handleErrorExit() {
  await Promise.all(pendingPromises);
  printAllErrors();
  if (errorsByFile.size > 0) {
    process.exit(1);
  }
}

let cleanupRegistered = false;
function registerCleanup() {
  if (cleanupRegistered) {
    return;
  }
  cleanupRegistered = true;

  process.on('beforeExit', () => {
    void handleErrorExit();
  });
}

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        modules: 'commonjs',
        targets: {
          electron: '34',
        },
      },
    ],
  ],
  plugins: [
    [
      require.resolve('babel-plugin-react-compiler'),
      {
        target: '19',
        logger: {
          logEvent(filename, event) {
            if (!debug) {
              return;
            }

            if (event.kind === 'CompileError') {
              registerCleanup();
              pendingPromises.push(processError(filename, event));
            }
          },
        },
      },
    ],
  ],
  only: ['**/ts/**'],
};
