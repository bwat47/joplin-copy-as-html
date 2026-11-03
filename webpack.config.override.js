module.exports = function applyWebpackOverrides(config) {
	if (!config || typeof config !== 'object') return config;

	const path = require('path');
	const webpack = require('webpack');

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
