const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
    const isProd = argv.mode === 'production';
    return {
        mode: isProd ? 'production' : 'development',
        stats: 'minimal',
        entry: {
            index: './src/index.js',
            'markdown-text-editor': './src/markdown/editor.js',
        },
        resolve: {
            extensions: ['.ts', '.js'],
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist'),
            library: {
                name: 'MarkdownEditor',
                type: 'umd',
                export: 'default',
            },
            globalObject: 'typeof self !== "undefined" ? self : this',
            clean: true, // Ensures output directory is cleaned before each build
        },
        module: {
            rules: [
                {
                    test: /\.css$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        'css-loader',
                        'postcss-loader',
                    ],
                },
                {
                    test: /\.m?js$/,
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
                filename: '[name].css',
            }),
            // Only add HtmlWebpackPlugin in development mode
            !isProd && new HtmlWebpackPlugin({
                template: 'index.html', // Path to your HTML file
                filename: 'index.html', // Output file name
            }),
        ].filter(Boolean), // Filter out false values in production mode
        optimization: {
            minimize: isProd,
            minimizer: [
                new TerserPlugin({
                    extractComments: false,
                }),
            ],
        },
        devtool: isProd ? 'source-map' : 'eval-source-map',
        
        // Updated devServer configuration
        devServer: {
            static: {
                directory: path.resolve(__dirname, 'dist'), // Serve content from 'dist' directory
            },
            compress: true, // Enable gzip compression
            port: 9000, // Set the port for the dev server
            open: true, // Automatically open the browser
            hot: true, // Enable hot module replacement
            historyApiFallback: true, // Support for single-page applications
            // You can add more configuration if needed
        },
    };
};
