import type { Slot } from "@domain/slot/Slot";

export interface SlotRepository {
  findById(id: string): Promise<Slot | null>;
  /** Every Slot currently in `open` status (time filtering is the caller's rule). */
  listOpen(): Promise<readonly Slot[]>;
  save(slot: Slot): Promise<void>;
}
