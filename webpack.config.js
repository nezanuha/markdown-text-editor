const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
    const isProd = argv.mode === 'production';
    return {
        mode: isProd ? 'production' : 'development',
        stats: 'minimal',
        entry: {
            index: './src/plugins/index.js',
            'markdown-text-editor': './src/plugins/markdown/editor.js',
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
        ],
        optimization: {
            minimize: isProd,
            minimizer: [
                new TerserPlugin({
                    extractComments: false,
                }),
            ],
        },
        devtool: isProd ? 'source-map' : 'eval-source-map',
    };
};
