import { EditorView, Panel } from "@codemirror/view";
import { ImportStatusListener } from "src/language/interpreter/interpreter";
import { FilePath } from "src/utilities/module_manager_sync";

let panelContainer: HTMLElement;
export function setPanelContent(s: string) {
    if (panelContainer) panelContainer.textContent = s;
}

export function statusPanel(view: EditorView): Panel {
    setPanelContent("default");
    if (!panelContainer) panelContainer = document.createElement("div");
    return {
        dom: panelContainer,
    };
}

export namespace EditorStatusPanel {
    export class ImportListener implements ImportStatusListener {
        onImportStarted(path: FilePath) {
            setPanelContent(`Importing ${path}...`);
        }

        onImportFailed(path: FilePath) {
            setPanelContent(`Importing ${path} failed...`);
        }

        onImportCompleted(path: FilePath) {
            setPanelContent(`Importing ${path} succeeded...`);
        }
    }
}
