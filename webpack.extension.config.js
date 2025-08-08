// webpack.extension.config.js
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'background/service-worker': './src/background/service-worker.js',
    'content/cursor-tracker': './src/content/cursor-tracker.js',
    'popup/popup': './src/popup/popup.js'
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
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/popup/popup.html', to: 'popup/popup.html' },
        {
          from: 'src/background/recording-manager.js',
          to: 'background/recording-manager.js'
        },
        {
          from: 'src/background/project-manager.js',
          to: 'background/project-manager.js'
        },
        {
          from: 'src/background/storage-manager.js',
          to: 'background/storage-manager.js'
        },
        // Copy editor files
        {
          from: 'src/editor',
          to: 'editor',
          globOptions: {
            ignore: ['**/.DS_Store']
          },
          noErrorOnMissing: true
        },
        // Copy assets
        {
          from: 'assets',
          to: 'assets',
          globOptions: {
            ignore: ['**/.DS_Store']
          },
          noErrorOnMissing: true
        }
      ]
    })
  ],
  resolve: {
    extensions: ['.js', '.ts']
  },
  optimization: {
    minimize: false // Keep readable for debugging
  }
};