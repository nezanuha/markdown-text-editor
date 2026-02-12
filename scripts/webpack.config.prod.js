const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const pkg = require(path.resolve(__dirname, '../package.json'));

const copyrightText = `${pkg.name} v${pkg.version} (c) ${(new Date()).getFullYear()} ${pkg.author} | Released under the ${pkg.license} License | ${pkg.homepage}`;

module.exports = (env, argv) => {
    return {
        mode: 'production',
        devtool: 'source-map',
        stats: 'minimal',
        entry: {
            index: './src/index.js',
            'markdown-text-editor': './src/components/Editor.js',
        },
        resolve: {
            extensions: ['.ts', '.js', '.css'],
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, '../dist'),
            library: {
                name: 'MarkdownEditor',
                type: 'umd',
                export: 'default',
            },
            globalObject: 'typeof self !== "undefined" ? self : this',
            clean: true,
        },
        module: {
            rules: [
                {
                    test: /\.css$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: 'css-loader',
                            options: { 
                                sourceMap: true
                            }
                        },
                        {
                            loader: 'postcss-loader',
                            options: { 
                                sourceMap: true
                            }
                        },
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
            new webpack.BannerPlugin({
                banner: copyrightText,
                raw: false
            }),
        ],
        cache: {
            type: 'filesystem',
        },
        optimization: {
            minimize: true,
            minimizer: [
                new TerserPlugin({
                    extractComments: true,
                    parallel: true,
                    terserOptions: {
                        sourceMap: true, 
                        format: {
                            comments: false,
                        },
                    },
                }),
            ],
        },
        devServer: {
            static: {
                directory: path.resolve(__dirname, '../dist'),
            },
            hot: true,
        },
    };
};