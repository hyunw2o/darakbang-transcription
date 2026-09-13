// Browser-only stand-ins. The tests exercise the real auth hook, never native SDKs or live accounts.
const state = () => window.mobileAuthFixture;
export const AppState = { addEventListener: (_, listener) => {
  state().foreground = listener;
  return { remove: () => { state().foreground = null; } };
} };
export const Linking = {
  getInitialURL: async () => state().initialUrl,
  addEventListener: (_, listener) => {
    state().deepLink = listener;
    return { remove: () => { state().deepLink = null; } };
  },
  openURL: async () => {},
};
export const Platform = { OS: 'android' };
export const maybeCompleteAuthSession = () => {};
export const createURL = route => `mallog24://${route}`;
export const AUTH_TOKEN_KEY = 'test-token';
export const AUTH_SESSION_EXPIRES_AT_KEY = 'test-expires-at';
export const AUTH_REQUEST_TIMEOUT_MS = 30000;
export const OURS_URL = 'https://example.invalid';
export const SITE_URL = 'https://example.invalid';
export const SUPABASE_URL = 'https://example.invalid';
export const getFriendlyAuthError = message => message;
export const isNetworkFetchError = error => error instanceof TypeError;
export const isTimeoutErrorMessage = message => /timeout/i.test(message);
export const requestApi = async (route, options) => {
  state().requests.push(route);
  return state().api(route, options);
};
export const requestApiWithTimeoutRetry = requestApi;
export const AppleAuthenticationScope = { FULL_NAME: 0, EMAIL: 1 };
export const isAvailableAsync = async () => false;
export const signInAsync = async () => { throw new Error('Unexpected Apple login'); };
export const openAuthSessionAsync = async () => ({ type: 'cancel' });
export default {
  multiGet: async keys => keys.map(key => [key, state().storage.get(key) || null]),
  multiSet: async entries => { for (const [key, value] of entries) state().storage.set(key, value); },
  multiRemove: async keys => { for (const key of keys) state().storage.delete(key); },
};
