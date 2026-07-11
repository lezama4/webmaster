/** Identifier source (port so domain/application stay deterministic in tests). */
export interface IdGenerator {
  next(): string;
}
