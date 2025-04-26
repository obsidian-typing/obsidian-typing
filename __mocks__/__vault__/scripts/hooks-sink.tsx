export const hookCalls: { hookName: string, ctx: any }[] = [];

export function appendHookCall(hookName: string, ctx: any) {
    hookCalls.push({ hookName, ctx });
}
