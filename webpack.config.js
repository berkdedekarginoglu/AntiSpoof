const path = require('path');
const JavaScriptObfuscator = require('webpack-obfuscator');

module.exports = {
    entry: {
        content: './content.js',
        popup: './popup.js'
    },
    output: {
        filename: '[name].bundle.js', // Output bundle files
        path: path.resolve(__dirname, 'dist') // Output directory
    },
    module: {
        rules: [
            {
                test: /\.js$/, // Apply this rule to .js files
                exclude: /node_modules/, // Exclude node_modules directory
                use: {
                    loader: 'babel-loader', // Use Babel loader for transpiling
                    options: {
                        presets: ['@babel/preset-env'] // Preset for modern JavaScript
                    }
                }
            }
        ]
    },
    plugins: [
        new JavaScriptObfuscator({
            rotateStringArray: true
        }, ['excluded_bundle_name.js']) // Exclude specific files from obfuscation
    ],
    mode: 'production' // Set the mode to production for optimization
};