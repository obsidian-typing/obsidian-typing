import { FieldOrigin } from "./origin";
import { SpanSpec } from "./span";

export interface MessageSpec {
    message: string;
    level?: "info" | "warning" | "error";
    span?: SpanSpec;
}

export type Severity = "info" | "warning" | "error";

export interface Message {
    location: FieldOrigin;
    message: string;
    level: Severity;
}
