export class CircularBuffer<T> {
  private buffer: Array<T | null>;
  private capacity: number;
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be greater than 0');
    }
    this.capacity = capacity;
    this.buffer = new Array<T | null>(capacity).fill(null);
  }

  isFull(): boolean {
    return this.size === this.capacity;
  }

  isEmpty(): boolean {
    return this.size === 0;
  }

  push(item: T): void {
    if (this.isFull()) {
      // Overwrite the oldest item
      this.buffer[this.tail] = item;
      this.head = (this.head + 1) % this.capacity; // Move head forward too
    } else {
      this.buffer[this.tail] = item;
      this.size++;
    }
    this.tail = (this.tail + 1) % this.capacity;
  }

  dequeue(): T {
    if (this.isEmpty()) {
      throw new Error('Buffer is empty');
    }

    const item = this.buffer[this.head];
    this.buffer[this.head] = null;
    this.head = (this.head + 1) % this.capacity;
    this.size--;
    return item!;
  }

  peek(): T | null {
    return this.isEmpty() ? null : this.buffer[this.head];
  }

  getSize(): number {
    return this.size;
  }

  getCapacity(): number {
    return this.capacity;
  }

  toArray(): Array<T> {
    const result: Array<T> = [];
    for (let i = 0; i < this.size; i++) {
      const idx = (this.head + i) % this.capacity;
      result.push(this.buffer[idx]!);
    }
    return result;
  }
}
