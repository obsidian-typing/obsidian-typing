// @ts-ignore // Transpilation of TS files is not yet supported
export const hookCalls /*: { hookName: string, ctx: any }[]*/ = [];

// @ts-ignore // Transpilation of TS files is not yet supported
export function appendHookCall(hookName /*: string*/, ctx /*: any*/) {
    hookCalls.push({ hookName, ctx });
}
