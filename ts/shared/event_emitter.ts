class EventEmitter<T extends Record<string, Array<any>>> {
  private events: Map<keyof T, Array<(...args: Array<any>) => void>> = new Map();

  // Subscribe to an event
  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
  }

  // Subscribe to an event only once
  once<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    const wrapper = (...args: T[K]) => {
      this.off(event, wrapper);
      listener(...args);
    };
    this.on(event, wrapper);
  }

  // Unsubscribe from an event
  off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    if (!this.events.has(event)) {
      return;
    }
    this.events.set(
      event,
      this.events.get(event)!.filter(l => l !== listener)
    );
  }

  // Trigger an event with optional arguments
  trigger<K extends keyof T>(event: K, ...args: T[K]): void {
    if (!this.events.has(event)) {
      return;
    }
    this.events.get(event)!.forEach(listener => listener(...args));
  }

  // Clear all listeners for an event
  clear<K extends keyof T>(event: K): void {
    this.events.delete(event);
  }
}

type SessionEvents = {
  registration_done: [];
  openInbox: [];
  configurationMessageReceived: [ourPubkey: string, displayName: string];
  UserSyncJobDone: [];
};

export class SessionEventEmitter extends EventEmitter<SessionEvents> {}
