// Called from webpack.config.js, which the plugin generator overwrites on
// upgrade. After upgrading, re-add the require and pass each config's name:
//   applyWebpackOverrides(pluginConfig, 'plugin');
//   applyWebpackOverrides(extraScriptConfig, 'extraScript');
//   applyWebpackOverrides(createArchiveConfig, 'archive');
const CONFIG_NAMES = ['plugin', 'extraScript', 'archive'];

module.exports = function applyWebpackOverrides(config, name) {
	if (!config || typeof config !== 'object') return config;
	if (!CONFIG_NAMES.includes(name)) {
		throw new Error(
			`applyWebpackOverrides: unknown config name "${name}". Expected one of: ${CONFIG_NAMES.join(', ')}.`,
		);
	}

	const path = require('path');
	const webpack = require('webpack');

	if (name === 'plugin') {
		const TerserPlugin = require('terser-webpack-plugin');

		// Minify the main MathJax bundle with swc instead of Terser.
		config.optimization = {
			...(config.optimization || {}),
			minimizer: [new TerserPlugin({ minify: TerserPlugin.swcMinify })],
		};
	}
	if (name === 'archive') {
		// The archive packages the already minified main bundle.
		config.optimization = {
			...(config.optimization || {}),
			minimize: false,
		};
	}

	// MathJax always imports its default font. Point it at the TeX font that
	// src/html/texRenderer.ts uses, so the unused default font isn't bundled.
	config.resolve = {
		...(config.resolve || {}),
		alias: {
			...((config.resolve && config.resolve.alias) || {}),
			'#default-font': path.resolve(__dirname, 'node_modules/@mathjax/mathjax-tex-font/mjs'),
		},
	};

	// Exclude JSDOM from the bundle since it's only used in test environments
	config.externals = {
		...(config.externals || {}),
		jsdom: 'commonjs jsdom',
	};

	config.plugins = [
		...(config.plugins || []),
		new webpack.NormalModuleReplacementPlugin(/^node:/, resource => {
			resource.request = resource.request.replace(/^node:/, '');
		}),
	];

	return config;
};
