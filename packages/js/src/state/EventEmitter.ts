type EventHandler<T = unknown> = (data: T) => void;

export class EventEmitter<TEvents extends Record<string, unknown> = Record<string, unknown>> {
  private handlers = new Map<keyof TEvents, Set<EventHandler>>();

  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)?.add(handler as EventHandler);
  }

  off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler);
  }

  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K] extends undefined ? [] : [TEvents[K]]): void {
    const data = args[0] as TEvents[K];
    this.handlers.get(event)?.forEach(handler => {
      (handler as EventHandler<TEvents[K]>)(data);
    });
  }

  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}
