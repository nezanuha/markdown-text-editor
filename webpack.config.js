const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
    const isProd = argv.mode === 'production';
    return {
        mode: isProd ? 'production' : 'development', // Set to 'production' for minified output
        entry: {
            "index":'./src/plugins/index.js',
            "markdown-text-editor": './src/plugins/markdown/editor.js'
        },
        output: {
            filename: '[name].min.js', // Output file name
            path: path.resolve(__dirname, 'dist'), // Output directory
            library: '[name]', // Name of the library
            libraryTarget: 'umd', // Universal Module Definition
            libraryExport: 'default', // Use default export
            globalObject: 'this', // Ensures it works in Node.js and browser
        },
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
        plugins: [
            new MiniCssExtractPlugin({
                filename: '[name].min.css', // Output CSS filename
            }),
        ],
        devtool: isProd ? false : 'source-map', // Enable source maps for easier debugging
        optimization: {
            minimize: true, // Enable minimization
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        format: {
                            comments: false, // Remove comments
                        },
                    },
                }),
            ],
        }
    }
};
