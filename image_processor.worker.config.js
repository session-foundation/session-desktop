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
    path: path.resolve(__dirname, 'app', 'ts', 'webworker', 'workers', 'node', 'image_processor'),
  },
  target: 'node',
  externals: {
    sharp: 'commonjs sharp',
  },
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
  },
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  watch: false, // false by default but can be overridden by the command line
  watchOptions: {
    aggregateTimeout: 200,
    poll: 1000,
  },
};
