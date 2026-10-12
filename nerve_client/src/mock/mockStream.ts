import { NerveEvent } from '../types/events';
import { MOCK_DEMO_SCRIPT } from './script';

export class MockEventStream {
  private script: NerveEvent[];
  private currentIndex: number = 0;
  private timer: number | null = null;
  private isPaused: boolean = false;
  private speed: number = 1;
  private onEventCallback: (event: NerveEvent) => void;
  private onCompleteCallback?: () => void;

  constructor(
    onEvent: (event: NerveEvent) => void,
    onComplete?: () => void,
    script: NerveEvent[] = MOCK_DEMO_SCRIPT
  ) {
    this.script = script;
    this.onEventCallback = onEvent;
    this.onCompleteCallback = onComplete;
  }

  public start() {
    this.stop();
    this.currentIndex = 0;
    this.isPaused = false;
    this.scheduleNext();
  }

  public setSpeed(speed: number) {
    this.speed = Math.max(0.25, Math.min(speed, 5));
  }

  public pause() {
    this.isPaused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.scheduleNext();
  }

  public stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public stepForward() {
    if (this.currentIndex < this.script.length) {
      const ev = this.script[this.currentIndex];
      this.currentIndex++;
      this.onEventCallback(ev);
      if (this.currentIndex >= this.script.length) {
        this.onCompleteCallback?.();
      }
    }
  }

  public getProgress(): { current: number; total: number } {
    return {
      current: this.currentIndex,
      total: this.script.length,
    };
  }

  private scheduleNext() {
    if (this.isPaused) return;

    if (this.currentIndex >= this.script.length) {
      this.timer = null;
      this.onCompleteCallback?.();
      return;
    }

    // Average step interval ~1.4s at 1x speed, scaling dynamically
    const baseDelay = 1200;
    const delay = Math.max(80, baseDelay / this.speed);

    this.timer = window.setTimeout(() => {
      if (this.isPaused) return;
      const ev = this.script[this.currentIndex];
      this.currentIndex++;
      this.onEventCallback(ev);
      this.scheduleNext();
    }, delay);
  }
}
