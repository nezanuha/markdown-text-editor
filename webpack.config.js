const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    entry: {
        index: './src/plugins/index.js',
        'markdown-text-editor': './src/plugins/markdown/editor.js',
    },
    output: {
        filename: '[name].js', // Output file name
        path: path.resolve(__dirname, 'dist'), // Output directory
        library: '[name]', // Name of the library
        libraryTarget: 'umd', // Universal Module Definition
        libraryExport: 'default', // Use default export
        globalObject: 'this', // Ensures compatibility
    },
    module: {
        rules: [
            {
                test: /\.css$/, // Handle CSS files
                use: [
                    'style-loader', // Extract CSS into separate files
                    'css-loader', // Translates CSS into CommonJS
                    'postcss-loader', // Processes CSS with PostCSS
                ],
            },
            {
                test: /\.m?js$/, // Handle JavaScript files
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].css', // Output CSS filename
        }),
    ],
    externals: {
        react: 'React', // Avoid bundling React, assume global React
        'react-dom': 'ReactDOM',
    },
    mode: 'production', // Set to 'production' for minified output
    devtool: 'source-map', // Enable source maps for easier debugging
};