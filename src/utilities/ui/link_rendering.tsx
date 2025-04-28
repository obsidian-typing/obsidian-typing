import styled from "@emotion/styled";
import classNames from "classnames";
import { AlertTriangle } from "lucide-react";
import { ComponentChildren } from "preact";
import { useState } from "react";
import styles from "src/styles/link.scss";
import { Note, Type } from "src/typing";

const ErrorPopover = styled.div`
    position: absolute;

    color: var(--text-normal);
    background-color: var(--background-secondary);
    border-radius: var(--radius-s);
    border-color: 2px solid var(--background-modifier-border);
    padding: var(--size-4-2);
`;

const ErrContainer = styled.span`
    color: red;
    background-color: var(--background-secondary);
    border-radius: var(--radius-s);
    border-color: 1px solid var(--background-modifier-border);
`;

const Error = ({ children }: { children: ComponentChildren }) => {
    let [open, setOpen] = useState(false);
    return (
        <ErrContainer
            onMouseEnter={(e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
                setOpen(true);
            }}
            onMouseLeave={(e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
                setOpen(false);
            }}
        >
            <AlertTriangle size={16} />
            {open && <ErrorPopover>{children}</ErrorPopover>}
        </ErrContainer>
    );
};

export const RenderLink = ({
    type,
    note,
    container,
    linkText,
    ...props
}: {
    type?: Type | null;
    note: Note;
    container?: HTMLElement | null;
    linkText?: string;
}) => {
    if (!type) {
        return <>{linkText ?? note.title}</>;
    }

    let linkScript = type.style?.link;
    if (linkScript) {
        try {
            let el = linkScript.call({ note, container: container ?? undefined, linkText, props });
            if (el) {
                return el;
            }
        } catch (e) {
            return (
                <>
                    {linkText ?? note.title}
                    <Error>{`React Link Error:\n${e}`}</Error>
                </>
            );
        }
        return;
    }

    let icon = type.icon;
    let showPrefix = type.style?.show_prefix ?? "auto";
    let prefix = note.prefix;

    return (
        <span class={styles.link}>
            {icon && <span class={classNames(styles.linkIcon, icon)} />}
            {!linkText && showPrefix != "never" && prefix && <span class={styles.linkPrefix}>{prefix}</span>}
            <span>{linkText ?? note.title}</span>
        </span>
    );
};
