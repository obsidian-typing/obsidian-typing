export function ifInArray<S extends string | undefined, A extends string>(str: S, array: readonly A[]): S & A | undefined {
    if (array.includes(str as S & A)) {
        return str as S & A;
    }
    return undefined;
}
