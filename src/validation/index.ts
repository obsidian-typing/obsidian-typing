import * as Validation from "./validation_namespace";
export * as Validation from "./validation_namespace";

export { ValidationContext } from "./validation_context";
export { ValidationResult } from "./validation_result";

export type ValidationMessage = Validation.Message;
export type ValidationTarget<T> = Validation.Target<T>;

export function report<T>(target: ValidationTarget<T>, params: Validation.MessageSpec): void {
    target.report(params);
}
