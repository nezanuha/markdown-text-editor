const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
    mode: isProduction ? 'production' : 'development',
    stats:'minimal',
    entry: {
        index:'./src/plugins/index.js',
        markdownEditor: './src/plugins/markdown/editor.js'
    },
    output: {
        filename: '[name].js', // Output file name
        path: path.resolve(__dirname, 'dist'), // Output directory
        library: { 
            name: 'frutjam',
            type: 'umd'
        },
        clean: isProduction ? true : false,
    },
    cache: isProduction ? {
        type: 'filesystem',
        compression: 'brotli',
        hashAlgorithm: 'md4',
        buildDependencies: {
          config: [__filename],
        },
    } : false,
    devtool: isProduction ? false : 'source-map',
    module: {
        rules: [
            {
                test: /\.css$/, // Handle CSS files
                use: [
       
                    'style-loader', // Inject CSS into the DOM
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
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx', '.css'],
    },
    optimization: isProduction ? {
        minimize: true, // Minimize JavaScript output
        minimizer: [new TerserPlugin({
          extractComments:false,
        })], // Use TerserPlugin for JavaScript minification
        splitChunks: { chunks: 'all' }, // Split chunks for better caching
    }: {},
    plugins: [
        new MiniCssExtractPlugin({
            filename: 'styles.css', // Output CSS filename
        }),
    ]
};
