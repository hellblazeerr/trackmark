export function createMutex() {
  let chain: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const result = chain.then(fn);
    chain = result.catch(() => {});
    return result;
  };
}
