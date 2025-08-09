const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'background/service-worker': './background/service-worker.js',
    'content/cursor-tracker': './content/cursor-tracker.js',
    'popup/popup': './popup/popup.js',
    'editor/recordings': './editor/recordings.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource'
      }
    ]
  },
  resolve: {
    extensions: ['.js']
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'manifest.json',
          to: 'manifest.json'
        },
        {
          from: 'popup/popup.html',
          to: 'popup/popup.html'
        },
        {
          from: 'editor/recordings.html',
          to: 'editor/recordings.html'
        },
        {
          from: 'assets',
          to: 'assets',
          noErrorOnMissing: true
        }
      ]
    })
  ],
  optimization: {
    splitChunks: {
      chunks: 'all'
    }
  },
  devtool: process.env.NODE_ENV === 'development' ? 'inline-source-map' : false,
  mode: process.env.NODE_ENV || 'development'
};