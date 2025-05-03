import { App, MarkdownView, Platform } from "obsidian";
import { DataviewApi } from "obsidian-dataview";
import { Interpreter } from "src/language";
import TypingPlugin from "src/main";
import { ImportManager } from "src/scripting";
import { Note, NoteCache, RelationsManager, TypeGraph } from "src/typing";
import { TypingAPI } from "./api";
import { CSSManager } from "./utilities";
import { EditorStatusPanel } from "./editor/status";

export class GlobalContext {
    app!: App;
    plugin!: TypingPlugin;
    importManager!: ImportManager;
    interpreter!: Interpreter;
    cssManager!: CSSManager;
    userDefinedCssManager!: CSSManager;
    noteCache!: NoteCache;

    testing: boolean = false;
    platform = Platform;

    types!: TypeGraph;
    relations!: RelationsManager;

    get settings() {
        return this.plugin.settings;
    }

    get api(): TypingAPI {
        return this.plugin.api;
    }

    get dv(): DataviewApi {
        if (this.testing) return {} as DataviewApi;
        // TODO: Throw when dataview is not available
        return this.app.plugins.plugins.dataview?.api!;
    }

    get currentNote(): Note | null {
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || !view.file) {
            return null;
        }
        let note = gctx.api.note(view.file.path);
        return note;
    }

    get isMobile(): boolean {
        return Platform.isMobile;
    }

    populateContext(plugin: TypingPlugin) {
        gctx.app = plugin.app;
        gctx.plugin = plugin;
        gctx.importManager = new ImportManager(plugin.app.vault, plugin);
        gctx.types = new TypeGraph();
        gctx.relations = new RelationsManager();
        gctx.interpreter = new Interpreter(plugin.app.vault, plugin, new EditorStatusPanel.ImportListener());
        gctx.noteCache = new NoteCache();

        if (gctx.testing) return;
        gctx.cssManager = new CSSManager("typing-global");
        gctx.userDefinedCssManager = new CSSManager("typing-user-defined");
    }
}

export let gctx = new GlobalContext();
