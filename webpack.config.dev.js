import common from "./webpack.common.js";
import {merge} from "webpack-merge";

export default merge(common, {
	mode: 'development',
	devtool: 'inline-source-map',
	devServer: {
		liveReload: true,
		hot: true,
		open: true,
		static: ['./'],
	},
});

//export default config;
