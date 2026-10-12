import { NerveEvent } from '../types/events';
import { MessageParticleItem } from '../types/domain';
import { PARTICLE_TRAVEL_MIN_MS } from '../motion/tokens';

export interface ChoreographerListener {
  onEventDispatched: (event: NerveEvent) => void;
  onParticleAdded: (particle: MessageParticleItem) => void;
  onParticleRemoved: (particleId: string) => void;
  onQueueEmpty?: () => void;
}

export class Choreographer {
  private queue: NerveEvent[] = [];
  private listeners: ChoreographerListener[] = [];
  private timer: number | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private speed: number = 1;
  private baseIntervalMs: number = 240;

  constructor(listeners: ChoreographerListener) {
    this.listeners.push(listeners);
  }

  public setSpeed(speed: number) {
    this.speed = Math.max(0.25, Math.min(speed, 5));
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (!paused && this.queue.length > 0 && !this.timer) {
      this.scheduleNext();
    }
  }

  public enqueue(events: NerveEvent | NerveEvent[]) {
    if (Array.isArray(events)) {
      this.queue.push(...events);
    } else {
      this.queue.push(events);
    }

    if (!this.isRunning && !this.isPaused) {
      this.isRunning = true;
      this.scheduleNext();
    }
  }

  public clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.queue = [];
    this.isRunning = false;
  }

  public stepForward() {
    if (this.queue.length === 0) return;
    const event = this.queue.shift();
    if (event) {
      this.dispatchEvent(event);
    }
  }

  private scheduleNext() {
    if (this.isPaused) return;

    if (this.queue.length === 0) {
      this.isRunning = false;
      this.timer = null;
      this.listeners.forEach((l) => l.onQueueEmpty?.());
      return;
    }

    // Dynamic delay: if backlog > 12 events, enter catch-up mode
    const backlog = this.queue.length;
    let delay = (this.baseIntervalMs / this.speed);
    if (backlog > 20) {
      delay = 20 / this.speed;
    } else if (backlog > 10) {
      delay = 60 / this.speed;
    }

    this.timer = window.setTimeout(() => {
      this.timer = null;
      if (this.queue.length > 0 && !this.isPaused) {
        const nextEvent = this.queue.shift()!;
        this.dispatchEvent(nextEvent);
        this.scheduleNext();
      }
    }, delay);
  }

  private dispatchEvent(event: NerveEvent) {
    this.listeners.forEach((l) => l.onEventDispatched(event));

    // If it's an agent_message, spawn a visual particle along the axon
    if (event.type === 'agent_message') {
      const pId = `particle-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const durationMs = Math.max(300, (PARTICLE_TRAVEL_MIN_MS / this.speed));

      const particle: MessageParticleItem = {
        id: pId,
        from: event.payload.from,
        to: event.payload.to,
        kind: event.payload.kind,
        summary: event.payload.summary,
        startedAt: Date.now(),
        durationMs,
      };

      this.listeners.forEach((l) => l.onParticleAdded(particle));

      window.setTimeout(() => {
        this.listeners.forEach((l) => l.onParticleRemoved(pId));
      }, durationMs + 50);
    }
  }
}
