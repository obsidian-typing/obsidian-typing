export type ParsedLink = {
    /** The file path this link points to. */
    path: string;
    /** The display name associated with the link. */
    display?: string;
    /** The block ID or header this link points to within a file, if relevant. */
    subpath?: string;
    /** Is this link an embedded link (!)? */
    embed: boolean;
    /** The type of this link, which determines what 'subpath' refers to, if anything. */
    type: "file" | "header" | "block";
    /** The original text of the link */
    linkpath: string;
}

const LINK_REGEXP = /(?<embed>!?)\[\[(?<inner>[^\[\]]*?)\]\]/u;

export function parseLink(value: string, forceLink?: true): ParsedLink;
export function parseLink(value: string, forceLink: false): ParsedLink | undefined;

export function parseLink(value: string, forceLink: boolean = true): ParsedLink | undefined {
    if (!forceLink && !LINK_REGEXP.exec(value)) {
        return undefined;
    }

    let embed = false;
    value = value ?? "";
    if (value.startsWith("![[")) {
        embed = true;
        value = value.slice(1);
    }
    if (value.startsWith("[[")) {
        value = value.slice(2);
    }
    if (value.endsWith("]]")) {
        value = value.slice(0, value.length - 2);
    }

    let path = "",
        subpath = "",
        display = "",
        linkpath = value;

    // Split by # first
    [path, value] = value.split("#", 2);
    value = value ?? "";

    // If there's no #, then we should handle the | directly
    if (!value && path.includes("|")) {
        [path, display] = path.split("|", 2);
        display = display ?? "";
    } else {
        [subpath, display] = value.split("|", 2);
        display = display ?? "";
    }

    let type: "file" | "header" | "block";
    if (!subpath) {
        type = "file";
    } else if (subpath.startsWith("^")) {
        type = "block";
        subpath = subpath.slice(1);
    } else {
        type = "header";
    }

    return {
        path,
        subpath: subpath || undefined,
        display: display || undefined,
        embed,
        type,
        linkpath
    };
}

export function parseLinkExtended(value: string) {
    let { path, subpath, display, linkpath } = parseLink(value);

    let folder = "",
        name = "",
        extension = "";

    if (path.includes("/")) {
        let segments = path.split("/");
        folder = segments.slice(0, segments.length - 1).join("/");
        name = segments[segments.length - 1];
    } else {
        folder = "";
        name = path;
    }

    ({ name, extension } = parseFileExtension(name));

    let result = { path, folder, name, extension, subpath, display, linkpath };
    return result;
}

export function parseFileExtension(name: string) {
    let extension = "";
    if (name.includes(".")) {
        let segments = name.split(".");
        name = segments.slice(0, segments.length - 1).join(".");
        extension = segments[segments.length - 1];
    }
    return { name, extension };
}
