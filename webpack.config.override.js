module.exports = function applyWebpackOverrides(config) {
	if (!config || typeof config !== 'object') return config;

	// Exclude JSDOM from the bundle since it's only used in test environments
	config.externals = {
		...(config.externals || {}),
		jsdom: 'commonjs jsdom',
	};

	return config;
};
