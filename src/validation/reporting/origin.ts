import { FieldPath } from "./path";
import { MultiSpan, Span } from "./span";

/**
 * Represents the source location of a value being validated,
 * to allow reporting these errors in the right locations in the
 * source code.
 *
 * Note that while all leaf nodes have a definable textual location,
 * intermediate nodes do not (e.g. in the case of Dataview inline fields).
 */
export interface FieldOrigin<Anchor = unknown> {
    /**
     * The frontmatter/inline dataview field from which the textual value was obtained.
     */
    readonly path: FieldPath;

    /**
     * The location within the textual value retrieved via {@link path} where the actual error occurs.
     *
     * Note that a single continuous span within the logical value of a field might translate to
     * multiple textual spans within the actual YAML source due to e.g. indented multiline strings.
     */
    readonly span: Span<Anchor> | MultiSpan<Anchor>;
}
