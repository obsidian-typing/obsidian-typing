import chokidar from "chokidar";
import Tsm from "typed-scss-modules";

/**
 * Generates and regenerates scss type declarations
 *
 * @param {string}  stylesPattern Glob pattern of input SCSS files.
 * @param {boolean} watch         Whether to automatically rebuild on changes.
 *
 * @returns {import('esbuild').Plugin}
 */
export const scssTypesPlugin = (stylesPattern, watch) => {
    const generateScssTypeDeclarations = async (pattern, options) => {
        console.log("GENERATE SCSS TYPES", pattern, options, Tsm);
        await Tsm.default(pattern, options);
    };

    let setupDone = false;

    return {
        name: "scss-types-plugin",
        setup(build) {
            console.log("setup", stylesPattern);
            build.onStart(async () => {
                console.log("onstart");
                await generateScssTypeDeclarations(stylesPattern, {  });
                setupDone = true;
            });

            if (watch) {
                console.log("setup watch");
                chokidar.watch(stylesPattern).on(
                    "all", // was on(change)
                    async (event, filename) => {
                        console.log("onwatch", event, filename);
                        if (event == "add" && !setupDone) return;
                        if (!(event == "change" || event == "add")) return;
                        await generateScssTypeDeclarations(filename);
                    }
                );
            }
        },
    };
};
