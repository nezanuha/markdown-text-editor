const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin'); // Optional in dev
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
    return {
        mode: 'development',
        devtool: 'eval-source-map',
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
                        'style-loader', 
                        {
                            loader: 'css-loader',
                            options: { sourceMap: true }
                        },
                        {
                            loader: 'postcss-loader',
                            options: { sourceMap: true }
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
            new HtmlWebpackPlugin({
                template: 'demo.html',
                filename: 'index.html',
                inject: 'body',
            }),
            new webpack.HotModuleReplacementPlugin(),
        ],
        cache: {
            type: 'filesystem',
        },
        optimization: {
            minimize: false,
            runtimeChunk: 'single',
        },
        devServer: {
            static: {
                directory: path.resolve(__dirname, '../dist'),
            },
            hot: true,
            port: 3000,
            open: true,
            historyApiFallback: true,
            client: {
                overlay: true,
            },
        },
    };
};