/** A value you can read and watch. Views subscribe; only models and controllers set it. */
export interface ReadOnlyObservable<T> {
  readonly value: T;
  /** Calls fn now with the current value and on every change. Returns an unsubscribe function. */
  subscribe(fn: (value: T) => void): () => void;
}

/** A small observable value (no library needed, works in browser, Node and Cocos). */
export class Observable<T> implements ReadOnlyObservable<T> {
  private listeners = new Set<(value: T) => void>();
  constructor(private current: T) {}

  get value(): T { return this.current; }

  set(next: T): void {
    if (Object.is(next, this.current)) return;
    this.current = next;
    for (const fn of Array.from(this.listeners)) fn(next);
  }

  subscribe(fn: (value: T) => void): () => void {
    this.listeners.add(fn);
    fn(this.current);
    return () => { this.listeners.delete(fn); };
  }

  /** Read-only view to hand to the View layer. */
  asReadOnly(): ReadOnlyObservable<T> { return this; }
}
