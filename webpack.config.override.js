module.exports = function applyWebpackOverrides(config) {
	if (!config || typeof config !== 'object') return config;

	const webpack = require('webpack');

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
