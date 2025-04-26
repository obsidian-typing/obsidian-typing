import { useCallback, useContext, useEffect, useState } from "react";
import { Contexts } from "..";

export type ControlKey = string | number;
export type ControlValue = string | number | boolean;
export type ControlsRecord = Record<ControlKey, ControlValue>;

export interface ControlSpec<T extends ControlValue = ControlValue> {
    value: T;
    setValue: (value: T) => Promise<T>;
    submitValue: (value: T) => Promise<T>;
}

type CompositeControl = {
    value: string;
    submitCurrentValue: () => void;
};

export type ControlsResult<T extends ControlsRecord> = CompositeControl & {
    [K in keyof T | keyof CompositeControl]:
    K extends keyof CompositeControl ? CompositeControl[K] :
    ControlSpec<T[K]>;
};


export function useControls<T extends ControlsRecord>({
    parse,
    compose,
}: {
    parse: (value: string) => T;
    compose: (values: T) => string;
    id?: string;
}): ControlsResult<Omit<T, keyof CompositeControl>> {
    const pickerCtx = useContext(Contexts.PickerContext)!;
    const value = pickerCtx.state.value;
    const [state, setState] = useState<T>(() => parse(value));

    useEffect(() => {
        setState(parse(value));
    }, [value, setState]);

    const updateStateAndContext = <K extends keyof T>(key: K, val: T[K], actionType: "SET_VALUE" | "SUBMIT_VALUE") => {
        return new Promise<T[K]>((resolve) =>
            setState((prevState) => {
                // NOTE: without functional setState we cannot edit two list components: one is reset
                const newState = { ...prevState, [key]: val };
                const newValue = compose(newState);
                pickerCtx.dispatch({ type: actionType, payload: newValue });
                resolve(parse(newValue)[key]);
                return newState;
            })
        );
    };

    const controls: CompositeControl = {
        value: compose(state),
        // TODO: or make functional
        submitCurrentValue: useCallback(
            // TODO: somehow call "beforeSubmit" argument of useControls
            () => {
                setState((state) => {
                    pickerCtx.dispatch({ type: "SUBMIT_VALUE", payload: compose(state) });
                    return state;
                });
            },
            [pickerCtx, compose, state]
        ),
    };
    const keys = Object.keys(state) as (keyof T)[];

    keys.forEach(<K extends keyof T>(key: K) => {
        let control: ControlSpec<T[K]> = {
            value: state[key],
            setValue: (val) => updateStateAndContext(key, val, "SET_VALUE"),
            submitValue: (val) => updateStateAndContext(key, val, "SUBMIT_VALUE"),
        };
        (controls as { [K in keyof T]: ControlSpec<T[K]> })[key] = control;
    });

    return controls as ControlsResult<T>;
}
