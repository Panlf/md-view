/** Serialize writes, deletes and moves so an older draft cannot reappear after saving. */
export function createDraftQueue() {
  const pending = new Map<string, Promise<unknown>>();
  return {
    run<T>(key: string, work: () => Promise<T>): Promise<T> {
      const task = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(work);
      pending.set(key, task);
      void task
        .finally(() => {
          if (pending.get(key) === task) pending.delete(key);
        })
        .catch(() => {});
      return task;
    },
    async flush() {
      await Promise.allSettled([...pending.values()]);
    }
  };
}
