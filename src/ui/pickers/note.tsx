import { ParsedLink, parseLink } from "src/utilities";
import { Picker } from ".";
import { Combobox, IComboboxOption, Input } from "../components";
import { ControlSpec, useControls } from "../hooks";

export const Note = ({
    options,
    subpath = false,
    display = false,
    preview,
}: {
    options: IComboboxOption[];
    subpath?: boolean;
    display?: boolean;
    preview?: (value: string) => any;
}) => {
    let controls = useControls({
        parse: parseLink as (value: string) => ParsedLink,
        compose({ path, subpath, display }) {
            let result = "";
            if (path) result += path;
            if (subpath) result += `#${subpath}`;
            if (display) result += `|${display}`;

            if (result.length) {
                return `[[${result}]]`;
            } else {
                return "";
            }
        },
    });

    return (
        <Picker>
            <Picker.Display value={controls.value} />
            <Picker.Body>
                <Combobox
                    static
                    autofocus
                    options={options}
                    control={controls.path}
                    preview={preview}
                    placeholder="Path"
                />
                {controls.path.value && subpath && (
                    <>
                        #
                        <Input control={controls.subpath as ControlSpec<string>} onChange={controls.subpath.setValue} placeholder="Subpath" />
                    </>
                )}
                {controls.path.value && display && (
                    <>
                        |
                        <Input control={controls.display as ControlSpec<string>} onChange={controls.display.setValue} placeholder="Display" />
                    </>
                )}
                <Picker.SubmitButton controls={controls} />
            </Picker.Body>
        </Picker>
    );
};
