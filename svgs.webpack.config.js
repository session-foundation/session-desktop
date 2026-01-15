// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

const svgsPath = path.resolve(__dirname, 'ts', 'svgs');
const outPath = path.resolve(__dirname, 'app', 'ts', 'svgs');

module.exports = {
  entry: './index.ts',
  context: svgsPath,
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(svgsPath, 'tsconfig.json'),
            transpileOnly: true,
          },
        },
      },
      {
        test: /\.svg$/,
        issuer: /\.ts$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              exportType: 'default',
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.svg'],
  },
  output: {
    filename: 'index.js',
    path: outPath,
    library: {
      type: 'commonjs2',
    },
  },
  externals: {
    react: 'commonjs2 react',
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
