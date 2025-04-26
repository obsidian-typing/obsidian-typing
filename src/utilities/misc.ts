function isObject(item: any): item is object {
    return item && typeof item === "object" && !Array.isArray(item);
}

export function mergeDeep<T, S>(target: T, source: S): T & S & {} {
    let output: T & S = Object.assign({}, target) as any;
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach((k) => {
            let key: keyof S & keyof T & string = k as any;
            if (isObject(source[key])) {
                if (!(key in target)) Object.assign(output!, { [key]: source[key] });
                else output[key] = mergeDeep(target[key] as any, source[key] as any) as any;
            } else {
                Object.assign(output!, { [key]: source[key] });
            }
        });
    }
    return output as T & S & {};
}
