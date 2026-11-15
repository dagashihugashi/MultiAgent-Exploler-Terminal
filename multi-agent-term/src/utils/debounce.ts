export interface DebouncedFn<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
}

/** Delays `fn` until `waitMs` has elapsed since the last call. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): DebouncedFn<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: A) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return Object.assign(debounced, { cancel });
}
