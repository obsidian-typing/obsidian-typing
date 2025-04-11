import { minimatch } from "minimatch";
import { Note, Type } from ".";

export class TypeGraph {
    public types: { [name: string]: Type } = {};
    private folderToType: { [folder: string]: Type } = {};
    private globToType: { [glob: string]: Type } = {};
    public isEmpty: boolean = true;
    public isReady: boolean = false;

    public isinstance(left: Note | Type | string, right: Type | string) {
        let left_type: typeof left | null = left;
        if (left_type instanceof Note) {
            left_type = left_type.type;
        }
        if (typeof left_type == "string") {
            left_type = this.get({ name: left_type });
        }
        let right_type: typeof right | null = right;
        if (typeof right_type == "string") {
            right_type = this.get({ name: right_type });
        }
        if (!left_type) return false;
        if (!right_type) return false;
        if (left_type.name === right_type.name) return true
        return left_type.isDescendantOf(right_type);
    }

    public get({ name, folder, path }: { name?: string; folder?: string; path?: string }) {
        if (name != null && name in this.types) {
            return this.types[name];
        }
        if (path != null) {
            folder = path.slice(0, path.lastIndexOf("/"));
            if (!folder || !folder.length) {
                return null;
            }
        }
        if (folder != null && folder in this.folderToType) {
            return this.folderToType[folder];
        }
        if (path != null) {
            for (let glob in this.globToType) {
                if (minimatch(path, glob)) {
                    return this.globToType[glob];
                }
            }
        }
        return null;
    }

    public add(type: Type) {
        this.types[type.name] = type;
        if (type.folder) this.folderToType[type.folder] = type;
        if (type.glob) this.globToType[type.glob] = type;
        this.isEmpty = false;
    }

    public clear() {
        this.types = {};
        this.folderToType = {};
        this.isEmpty = true;
    }
}
