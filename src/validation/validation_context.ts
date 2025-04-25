import { Message } from "./reporting/message";
import { ValidationResult } from "./validation_result";

export interface LinkResolutionContext {
    sourcePath?: string;
}

export class ValidationContext {
    messages: Message[] = [];

    report(message: Message): void {
        this.messages.push(message);
    }

    toResult(): ValidationResult {
        return {
            ok: this.messages.length === 0,
            messages: this.messages as any
        }
    }
}
