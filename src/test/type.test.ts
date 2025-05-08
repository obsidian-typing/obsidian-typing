import { App, Vault } from "obsidian";
import { gctx } from "src/context";
import TypingPlugin from "src/main";
import { dedent } from "src/utilities";

beforeAll(async () => {
    gctx.testing = true;
    // @ts-ignore
    let app = new App(new Vault("__vault__"));
    let plugin = new TypingPlugin(app, null);
    await plugin.onload();
    // @ts-ignore
    await app.workspace.triggerLayoutReady();
});

test("smoke graph initialization", () => {
    expect(gctx.types).toBeDefined();
    let A = gctx.types.get({ name: "A" });
    expect(A).toBeDefined();
});

test("create new", async () => {
    expect(gctx.types).toBeDefined();
    let D = gctx.types.get({ name: "D" });
    expect(D).toBeDefined();
    let note = await D.create({
        title: "New D",
        prefix: "D-1",
        fields: { one: "value one", two: "value two", three: "value three" },
        text: "some\ncontent",
    });
    expect(note).toBeDefined();
    expect(note.title).toBe("New D");
    expect(note.prefix).toBe("D-1");
    expect(note.file).toBeDefined();
    expect(note.file.path).toBe("d/D-1 New D.md");
    let content = await gctx.app.vault.read(note.file);
    expect(content).toBe(
        dedent(`
            one :: value one
            two :: value two
            three :: value three

            some
            content
`)
    );
});

test("hooks", async () => {
    let { hookCalls } = gctx.api.import("scripts/hooks-sink");
    expect(gctx.types).toBeDefined();
    let HooksType = gctx.types.get({ name: "Hooks" });
    expect(HooksType).toBeTruthy();
    let note = await HooksType.create({
        title: "HooksName",
    });
    expect(note).toBeTruthy();
    expect(note.title).toBe("HooksName");
    expect(note.file).toBeTruthy();
    expect(note.file.path).toBe("hooks/HooksName.md");
    expect(hookCalls).toBeTruthy();
    expect(hookCalls).toHaveLength(1);
    expect(hookCalls[0].hookName).toEqual("on_create");
    expect(hookCalls[0].ctx.note.path).toEqual("hooks/HooksName.md");
    await note.rename({ title: "HooksName2" });
    expect(hookCalls).toHaveLength(2);
    expect(hookCalls[1].hookName).toEqual("on_rename");
    expect(hookCalls[1].ctx.note.path).toEqual("hooks/HooksName2.md");
    expect(hookCalls[1].ctx.prevTitle).toEqual("HooksName");
    expect(hookCalls[1].ctx.prevFilename).toEqual("HooksName.md");
    expect(hookCalls[1].ctx.prevPath).toEqual("hooks/HooksName.md");
});

test("methods", async () => {
    expect(gctx.types).toBeDefined();
    let note = gctx.api.note("methods/A.md");
    expect(note).toBeTruthy();
    expect(note.methods).toBeTruthy();
    expect(note.methods.one).toBeTruthy();
    expect(note.methods.inc).toBeTruthy();
    expect(note.methods.inc(100)).toEqual(101);
});

test("compilation modes", async () => {
    expect(gctx.types).toBeDefined();
    let note = gctx.api.note("methods/A.md");
    expect(note).toBeTruthy();
    let methods  = note.type.methods;
    expect(methods.one.function.mode).toBe("tsx");
    expect(methods.inc.function.mode).toBe("ts");
    expect(methods.js_test.function.mode).toBe("js");
    expect(methods.ts_test.function.mode).toBe("ts");
    expect(methods.jsx_test.function.mode).toBe("jsx");
    expect(methods.tsx_test.function.mode).toBe("tsx");
});

test("import from relative", async () => {
    expect(gctx.types).toBeDefined();
    let note = gctx.api.note("folder/file.md");
    expect(note).toBeTruthy();
    expect(note.methods).toBeTruthy();
    expect(note.methods.one).toBeTruthy();
    expect(note.methods.one()).toEqual(1);
});
