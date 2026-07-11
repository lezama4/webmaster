import { randomUUID } from "node:crypto";
import type { IdGenerator } from "@application/ports/IdGenerator";

/** CSPRNG-backed `IdGenerator` adapter (UUIDv4, Node's built-in `crypto`). */
export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
