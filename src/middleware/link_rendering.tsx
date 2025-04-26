import { getLinkpath, MarkdownPostProcessor, MarkdownPostProcessorContext, MarkdownRenderChild, TAbstractFile, TFile } from "obsidian";
import TypingPlugin from "src/main";
import { eagerDebounce, render, RenderLink } from "src/utilities";
import { gctx } from "../context";
import { Note } from "../typing/note";

const TIMEOUT = 1000;

class LinkRenderChild extends MarkdownRenderChild {
    note?: Note;
    updateDebounced: () => void;

    constructor(containerEl: HTMLElement, public path: string, public text?: string) {
        super(containerEl);

        this.updateDebounced = eagerDebounce(this.update, TIMEOUT);

        // BUG: onload() is only called on links in body, doesn't work inside dv.renderValue,
        // hence callung update() on initialization
        this.updateDebounced();
    }
    show = async () => {
        let note = this.note;
        let type = note?.type;
        if (!note || !type) return;

        let el = RenderLink({ note, type, container: this.containerEl, linkText: this.text });

        render(el, this.containerEl);
    };
    onload() {
        this.registerEvent(gctx.plugin.app.metadataCache.on("dataview:metadata-change", this.onMetadataChange));
        this.registerEvent(gctx.plugin.app.metadataCache.on("typing:schema-change", this.onSchemaChange));
        this.updateDebounced();
    }
    onunload() {}
    onMetadataChange = (op: "rename" | "delete" | "update", file: TAbstractFile, _oldPath?: string) => {
        if (file.path === this.path) {
            this.updateDebounced();
        }
    };
    onSchemaChange = () => {
        this.updateDebounced();
    };
    update = async () => {
        this.note = gctx.api.note(this.path);
        if (!this.note) {
            return;
        }
        // this.hide();
        await this.show();
    };
    hide = () => {
        while (this.containerEl.firstChild) {
            this.containerEl.removeChild(this.containerEl.firstChild);
        }
    };
}

function linkPostProcessor(plugin: TypingPlugin): MarkdownPostProcessor {
    return async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        if (!gctx.settings.linksInPreview) return;
        el.querySelectorAll<HTMLAnchorElement>("a.internal-link").forEach((linkEl) => {
            if (!(linkEl instanceof HTMLAnchorElement)) {
                return;
            }
            if (linkEl.classList.contains("no-postprocessing")) {
                return;
            }

            let linkText = linkEl.getAttr("href");
            if (linkText === null) {
                return;
            }
            let linkPath = getLinkpath(linkText);

            let resolvedTFile = plugin.app.metadataCache.getFirstLinkpathDest(linkPath, ctx.sourcePath);
            if (!resolvedTFile || resolvedTFile.extension !== "md") {
                return;
            }

            let resolvedPath = resolvedTFile.path;
            let linkDisplay;

            if (linkEl.innerText != linkEl.getAttr("data-href")) {
                linkDisplay = linkEl.innerText;
            }

            ctx.addChild(new LinkRenderChild(linkEl, resolvedPath, linkDisplay));
        });
    };
}

export function registerLinkPostProcessor(plugin: TypingPlugin) {
    let postProcess = linkPostProcessor(plugin);
    plugin.registerMarkdownPostProcessor(postProcess);
}
