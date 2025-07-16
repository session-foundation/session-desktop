// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

module.exports = {
  entry: './ts/webworker/workers/node/image_processor/image_processor.worker.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      crypto: false,
      path: false,
      fs: false,
      stream: false,
    },
  },
  output: {
    filename: 'image_processor.worker.compiled.js',
    path: path.resolve(__dirname, 'ts', 'webworker', 'workers', 'node', 'image_processor'),
  },
  target: 'node',
  optimization: {
    minimize: true,
  },
  externals: {
    sharp: 'commonjs sharp',
  },
};
