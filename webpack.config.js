const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
    const isProd = process.env.NODE_ENV === 'production';
    return {
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
                filename: 'styles.css', // Output CSS filename
            }),
        ],
        externals: {
            react: 'React', // Avoid bundling React, assume global React
            'react-dom': 'ReactDOM',
        },
        mode: isProd ? 'production' : 'development', // Set to 'production' for minified output
        devtool: isProd ? false : 'source-map', // Enable source maps for easier debugging
    };
};