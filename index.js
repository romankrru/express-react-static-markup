const React = require('react');
const ReactDOMServer = require('react-dom/server');
const escapeRegExp = require('lodash.escaperegexp');

const LocalsContext = React.createContext();

const DEFAULT_OPTIONS = {
	doctype: '<!DOCTYPE html>',
	transformViews: true,

	babel: {
		presets: [
			'@babel/preset-react',

			[
				'@babel/preset-env',
				{targets: {node: 'current'}},
			],
		],
	},
};

const createEngine = engineOptions => {
	let registered = false;
	let moduleDetectRegEx;
	let markup;

	engineOptions = {...DEFAULT_OPTIONS, engineOptions};

	const renderFile = (filename, options, cb) => {
		// Defer babel registration until the first request so we can grab the view path.
		if (!moduleDetectRegEx) {
			// Path could contain regexp characters so escape it first.
			// options.settings.views could be a single string or an array
			moduleDetectRegEx = new RegExp(
				[]
					.concat(options.settings.views)
					.map(viewPath => '^' + escapeRegExp(viewPath))
					.join('|')
			);
		}

		if (engineOptions.transformViews && !registered) {
			// Passing a RegExp to Babel results in an issue on Windows so we'll just
			// pass the view path.
			require('@babel/register')({
				...engineOptions.babel,
				only: [].concat(options.settings.views)
			});

			registered = true;
		}

		try {
			let component = require(filename);

			// Transpiled ES6 may export components as { default: Component }
			component = component.default || component;

			markup = engineOptions.doctype + ReactDOMServer.renderToStaticMarkup(
				// Wrap view with locals context provider
				React.createElement(
					LocalsContext.Provider,
					{value: options._locals},
					React.createElement(component, options)
				)
			);
		} catch (e) {
			return cb(e);
		} finally {
			if (options.settings.env === 'development') {
				// Remove all files from the module cache that are in the view folder.
				Object.keys(require.cache).forEach(function(module) {
					if (moduleDetectRegEx.test(require.cache[module].filename)) {
						delete require.cache[module];
					}
				});
			}
		}


		cb(null, markup);
	};

	return renderFile;
};

exports.createEngine = createEngine;
exports.LocalsContext = LocalsContext.Consumer;
