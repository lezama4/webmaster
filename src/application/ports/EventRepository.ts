import type { Event } from "@domain/event/Event";

export interface EventRepository {
  findById(id: string): Promise<Event | null>;
  save(event: Event): Promise<void>;
}
