const fs = require('fs');
const { SourceMapConsumer } = require('source-map');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

// Cache for source map consumers
const sourceMapCache = new Map();

// Number of lines to show before/after error
const CONTEXT_LINES = 2;

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
            if (event.kind === 'CompileError') {
              const debug = process.env.SESSION_RC_DEBUG;
              if (!debug) {
                return;
              }

              const errorLoc = event.detail?.options?.loc;
              const fnLoc = event.fnLoc;
              const reason = event.detail?.options?.reason || 'Unknown error';
              const category = event.detail?.options?.category || 'Unknown';

              (async () => {
                const outBuffer = [];
                outBuffer.push(
                  `\n${colors.red}${colors.bright}[CompileError]${colors.reset} ${colors.cyan}${filename}${colors.reset}`
                );
                outBuffer.push(`  ${colors.yellow}Category:${colors.reset} ${category}`);
                outBuffer.push(`  ${colors.yellow}Reason:${colors.reset} ${reason}`);

                if (!fnLoc || !errorLoc) {
                  return;
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
                  const errEndOrig = await getOriginalLocation(
                    filename,
                    errorLoc.end.line,
                    errorLoc.end.column
                  );

                  if (errStartOrig) {
                    errStartLine = errStartOrig.line;
                    errColStart = errStartOrig.column;
                  }
                  if (errEndOrig) {
                    errEndLine = errEndOrig.line;
                    errColEnd = errEndOrig.column;
                  }
                }

                // Show context around the error
                const contextStart = Math.max(0, errStartLine - CONTEXT_LINES - 1);
                const contextEnd = Math.min(lines.length, errEndLine + CONTEXT_LINES);

                outBuffer.push(
                  `  ${colors.yellow}Source:${colors.reset} ${colors.dim}${sourceName}${colors.reset}`
                );
                outBuffer.push(
                  `  ${colors.yellow}Error at:${colors.reset} line ${errStartLine}, columns ${errColStart}-${errColEnd}`
                );
                outBuffer.push(`  ${colors.dim}${'─'.repeat(60)}${colors.reset}`);

                for (let i = contextStart; i < contextEnd; i++) {
                  const lineNum = i + 1;
                  const lineNumStr = lineNum.toString().padStart(4, ' ');
                  const line = lines[i] || '';

                  const isErrorLine = lineNum >= errStartLine && lineNum <= errEndLine;

                  if (isErrorLine) {
                    const gutter = `${colors.bgRed}${colors.white} ${lineNumStr} ${colors.reset}`;

                    if (errColStart !== null && errColEnd !== null && lineNum === errStartLine) {
                      const before = line.substring(0, errColStart);
                      const highlight = line.substring(errColStart, errColEnd);
                      const after = line.substring(errColEnd);
                      outBuffer.push(
                        `  ${gutter} ${before}${colors.bgYellow}${colors.bright}${highlight}${colors.reset}${after}`
                      );

                      const underline =
                        ' '.repeat(errColStart) + '^'.repeat(Math.max(1, errColEnd - errColStart));
                      outBuffer.push(
                        `  ${colors.dim}      ${colors.reset} ${colors.red}${underline}${colors.reset}`
                      );
                    } else {
                      outBuffer.push(`  ${gutter} ${colors.red}${line}${colors.reset}`);
                    }
                  } else {
                    const gutter = `${colors.dim} ${lineNumStr} ${colors.reset}`;
                    outBuffer.push(`  ${gutter} ${line}`);
                  }
                }

                outBuffer.push(`  ${colors.dim}${'─'.repeat(60)}${colors.reset}`);

                for (const line of outBuffer) {
                  console.log(line);
                }
              })();
            }
          },
        },
      },
    ],
  ],
  only: ['**/ts/**'],
};
