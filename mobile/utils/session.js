export function sessionEndedError() {
  const error = new Error("Session is no longer active.");
  error.name = "AbortError";
  return error;
}

// A scope belongs to one verified login, never to a token restored optimistically.
export function createSessionScope({ token, expiresAt, onExpired = () => {} }) {
  const controller = new AbortController();
  const scope = {
    token,
    expiresAt,
    signal: controller.signal,
    invalidate: () => controller.abort(),
    isActive() {
      if (controller.signal.aborted || !token) return false;
      if (!expiresAt || expiresAt <= Date.now()) {
        controller.abort();
        onExpired();
        return false;
      }
      return true;
    },
    assertActive() {
      if (!scope.isActive()) throw sessionEndedError();
    },
    async request(request, path, options = {}, retryOptions) {
      scope.assertActive();
      try {
        const data = await request(path, { ...options, token, signal: controller.signal }, retryOptions);
        scope.assertActive();
        return data;
      } catch (error) {
        if (!controller.signal.aborted && error?.status === 401) {
          controller.abort();
          onExpired();
        }
        throw error;
      }
    },
  };
  return scope;
}
