// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

const svgsPath = path.resolve(__dirname, 'ts', 'svgs');

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
    extensions: ['.ts', '.js', '.svg'],
  },
  output: {
    filename: 'index.js',
    path: svgsPath,
    library: {
      type: 'commonjs2',
    },
  },
  externals: {
    react: 'commonjs2 react',
  },
  optimization: {
    minimize: false,
  },
  mode: 'development',
  devtool: false,
};
