/* eslint-disable consistent-return */
/* eslint-disable no-promise-executor-return */

export const createTaskWithTimeout = (task: any, id: string, givenTimeout?: number) => {
  const timeout = givenTimeout || 1000 * 60 * 3; // three minutes

  const errorForStack = new Error('for stack');
  return async () =>
    new Promise((resolve, reject) => {
      let complete = false;
      let timer: NodeJS.Timeout | null = global.setTimeout(() => {
        if (!complete) {
          const message = `${id || ''} task did not complete in time. Calling stack: ${
            errorForStack.stack
          }`;

          window?.log?.error(message);
          reject(new Error(message));
        }
      }, timeout);
      const clearTimer = () => {
        try {
          const localTimer = timer;
          if (localTimer) {
            timer = null;
            global.clearTimeout(localTimer);
          }
        } catch (error) {
          window?.log?.error(
            id || '',
            'task ran into problem canceling timer. Calling stack:',
            errorForStack.stack
          );
        }
      };

      const success = (result: any) => {
        clearTimer();
        complete = true;
        resolve(result);
      };
      const failure = (error: any) => {
        clearTimer();
        complete = true;
        reject(error);
      };

      let promise;
      try {
        promise = task();
      } catch (error) {
        clearTimer();
        throw error;
      }
      if (!promise || !promise.then) {
        clearTimer();
        complete = true;
        resolve(promise);
        return;
      }

      // eslint-disable-next-line more/no-then
      return promise.then(success, failure);
    });
};
