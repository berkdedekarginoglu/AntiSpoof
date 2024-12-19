/*
1) Install Dependencies: Ensure you have the necessary dependencies installed.
npm install --save-dev webpack webpack-cli babel-loader @babel/core @babel/preset-env webpack-obfuscator

2) Build the Project: Run Webpack to bundle and obfuscate your code.
npx webpack --config webpack.config.js

3) Prepare for Publishing: Ensure your manifest.json and other necessary files are in the dist directory.
cp manifest.json dist/
cp -r img dist/
cp popup.html dist/
cp popup.css dist/
cp local.json dist/
cp chart.js dist/
cp privacy-policy dist/
cp LICENSE dist/
cp icon-16.png dist/
cp icon-48.png dist/
cp icon-128.png dist/
cp README.md dist/
cp background.js dist/
cp content.css dist/
cp excluded_domains.json dist/

4) Zip the dist Directory: Create a zip file of the dist directory for uploading to the Chrome Web Store.
cd dist
zip -r ../extension.zip *
cd ..

5) Upload to Chrome Web Store: Go to the Chrome Web Store Developer Dashboard and upload the extension.zip file.
*/




const path = require('path');
const JavaScriptObfuscator = require('webpack-obfuscator');

module.exports = {
    entry: {
        content: './content.js',
        popup: './popup.js'
    },
    output: {
        filename: '[name].js', // Output bundle files
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