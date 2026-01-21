/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');

module.exports = {
  entry: './ts/webworker/workers/node/libsession/libsession.worker.ts',
  node: {
    __dirname: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.node$/,
        loader: 'node-loader',
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
    filename: 'libsession.worker.compiled.js',
    path: path.resolve(__dirname, 'app', 'ts', 'webworker', 'workers', 'node', 'libsession'),
  },
  target: 'node',
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
