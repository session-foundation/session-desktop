import { useCallback, useRef } from 'react';

export function useHistory<T = unknown>(initialCommit?: T) {
  const initialState = useRef<T | undefined>(initialCommit);

  const undoStack = useRef<Array<T>>([]);
  const redoStack = useRef<Array<T>>([]);

  const undo = useCallback(() => {
    let state = undoStack.current.pop();
    if (!state && !undoStack.current.length) {
      state = initialState.current;
    }

    if (state) {
      redoStack.current.push(state);
    }

    return state;
  }, [undoStack]);

  const redo = useCallback(() => {
    const state = redoStack.current.pop();

    if (state) {
      undoStack.current.push(state);
    }

    return state;
  }, [redoStack]);

  const commit = useCallback(
    (v: T) => {
      undoStack.current.push(v);

      if (redoStack.current.length > 0) {
        redoStack.current = [];
      }
    },
    [undoStack]
  );

  const reset = useCallback((content: T) => {
    undoStack.current = [];
    redoStack.current = [];
    initialState.current = content;
  }, []);

  return {
    undo,
    redo,
    commit,
    reset,
  };
}
