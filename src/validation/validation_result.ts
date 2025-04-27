import { Message } from "./reporting/message";

export interface ValidationResult {
    readonly ok: boolean;
    readonly messages: Message[]
}
