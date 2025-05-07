import { SpacingRulesSpec } from "./spacing";

export interface SpacingSettings {
    spaceAroundParameterAssignment: boolean;
    keepLineBreaks: boolean;
    keepBlankLines: number;
}

export function getSpacingSettings(): SpacingSettings {
    return {
        spaceAroundParameterAssignment: false,
        keepLineBreaks: true,
        keepBlankLines: 1,
    };
}

export function getSpacingRules(settings: SpacingSettings): SpacingRulesSpec {
    return [
        { inside: "Assignment", around: "=", spaces: 1 },
        { inside: "Assignment", after: ":", before: "AssignmentType", spaces: 1 },
        { inside: "AssignmentMark", after: "`", before: "Identifier", spaces: 0 },
        { inside: "AssignmentMark", after: "Identifier", before: "`", spaces: 0 },
        { inside: "AssignmentType", after: "[", spaces: 0 },
        { inside: "AssignmentType", before: "]", spaces: 0 },
        { inside: "ExtendsClause", after: "extends", spaces: 1 },
        { inside: "ExtendsClause", after: "LooseIdentifier", before: ",", spaces: 0 },
        { inside: "ExtendsClause", after: ",", spaces: 1 },
        { inside: "ImportedSymbol", around: "as", spaces: 1 },
        { inside: "ImportedSymbols", before: ",", spaces: 0 },
        { inside: "ImportedSymbols", after: ",", spaces: 1 },
        { inside: "ImportStatement", around: "from", spaces: 1 },
        { inside: "ImportStatement", after: "{", spaces: 1 },
        { inside: "ImportStatement", before: "}", spaces: 1 },
        { inside: "List", after: "[", spaces: 0 },
        { inside: "List", before: "[", spaces: 0 },
        { inside: "List", before: ",", spaces: 0 },
        { inside: "List", after: ",", spaces: 1 },
        { inside: "Parameter", around: "=", spaceIf: settings.spaceAroundParameterAssignment },
        { inside: "ParameterList", after: "Parameter", before: ",", spaces: 0 },
        { inside: "ParameterList", after: ",", before: "Parameter", spaces: 1 },
        { inside: "SectionDeclaration", after: "Identifier", before: "SectionBody", spaces: 1 },
        { inside: "Tag", around: "Dot", spaces: 0 },
        { inside: "TaggedString", after: "Tag", before: "String", spaces: 0 },
        { inside: "TypeDeclaration", after: "abstract", spaces: 1 },
        { inside: "TypeDeclaration", after: "type", spaces: 1 },
        { inside: "TypeDeclaration", before: "ExtendsClause", spaces: 1 },
        { inside: "TypeDeclaration", before: "TypeBody", spaces: 1 },
    ];
};
