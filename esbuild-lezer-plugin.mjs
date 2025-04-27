import { buildParserFile } from "@lezer/generator";
import chokidar from "chokidar";
import fs from "fs";

/**
 * Generate a `*_parser.js` based on a given grammar file.
 *
 * @param {string} grammarFile Path to grammar file to be loaded.
 * @param {string} parserFile  Output path for the parser implementation.
 * @returns {void}
 */
const generateParser = async (grammarFile, parserFile) => {
    console.log("LEZER: generate parser");
    const grammar = fs.readFileSync(grammarFile, "utf-8");
    const { parser, terms } = buildParserFile(grammar, {
        moduleStyle: "cjs",
    });
    fs.writeFileSync(parserFile, parser);
};

/**
 * @param {string} str Entity name in the grammar file.
 * @returns {string} Entity name in the rules file.
 */
const codeNameForNodeType = (str) =>
    !str ? str : /^[A-Z]/.test(str) ? str : "Keyword" + str[0].toUpperCase() + str.slice(1);

/**
 * Generate a `.rules.ts` file containing an enum with all AST node types
 * based on the specified {@link parserFile}.
 *
 * @param {string} parserFile Path to parser file to be loaded,
 * @param {*}      rulesFile  Output path for the rules file.
 * @returns {void}
 */
const generateRulesEnum = async (parserFile, rulesFile) => {
    console.log("LEZER: generate rules enum");
    const enumName = "Rules";
    let enumContent = `export enum ${enumName} {\n`;

    let { parser } = await import(parserFile);

    let rules = parser.nodeSet.types.map((x) => x.name).filter((x) => /^[A-Za-z]/.test(x));

    for (const name of rules) {
        enumContent += `    ${codeNameForNodeType(name)} = "${name}",\n`;
    }

    enumContent += "}\n";
    fs.writeFileSync(rulesFile, enumContent);
};

/**
 * Generate JS parser and lexer from a grammar file.
 *
 * @param {string}  grammarFile The input grammar.
 * @param {boolean} watch       Whether to rebuild automatically on changes.
 *
 * @returns {import("esbuild").Plugin}
 */
export const lezerPlugin = (grammarFile, watch) => {
    const parserFile = grammarFile.replace(/(\.[^\.]+)$/, "_parser.js");
    const rulesFile = grammarFile.replace(/(\.[^\.]+)$/, "_parser.rules.ts");

    const buildLezer = () => {
        generateParser(grammarFile, parserFile);
        generateRulesEnum(parserFile, rulesFile);
    };

    return {
        name: "lezer-plugin",
        setup(build) {
            console.log("setup", build.initialOptions.watch, build.initialOptions, build);
            build.onStart(buildLezer);

            if (watch) {
                chokidar.watch(grammarFile).on("change", buildLezer);
            }
        },
    };
};
