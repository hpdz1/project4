/** Thrown when an account's id, alias (case-insensitive) or key hash is already taken. */
export class DuplicateAccountError extends Error {
  readonly field: "id" | "alias" | "keyHash";

  constructor(field: "id" | "alias" | "keyHash") {
    super(`An account with this ${field} already exists`);
    this.name = "DuplicateAccountError";
    this.field = field;
  }
}
