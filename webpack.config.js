const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// The shared leaderboard's access key, read from the environment at BUILD time and inlined into the
// bundle by DefinePlugin below.
//
// NOT A SECRET, AND IT CANNOT BE ONE. It ships inside a JavaScript bundle a browser downloads, so
// anyone can read it — PRD §3.1 accepts that outright and designs the board as a shared wall rather
// than a verified ranking. What this buys is ROTATION: changing the key is a rebuild rather than an
// edit to a tracked source file, and a fork or a local dev build with no env var simply has no
// board instead of posting into somebody else's.
//
// Defaults to the empty string, which persistence/leaderboardClient.js reads as "not configured" —
// every leaderboard call becomes a no-op and the rest of the game is untouched.
const LEADERBOARD_ACCESS_KEY = process.env.LEADERBOARD_ACCESS_KEY || '';

module.exports = {
  entry: path.resolve(__dirname, 'src/index.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      LEADERBOARD_ACCESS_KEY: JSON.stringify(LEADERBOARD_ACCESS_KEY),
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public/index.html'),
    }),
  ],
  devServer: {
    static: path.resolve(__dirname, 'dist'),
    port: 8080,
    open: false,
    hot: true,
  },
};
