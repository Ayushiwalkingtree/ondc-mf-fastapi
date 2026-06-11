const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const isLocalHost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';

const localApiBaseUrl = (): string => {
  const protocol = window.location.protocol || 'http:';
  return `${protocol}//${window.location.hostname}:8000`;
};

const localWebSocketBaseUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

export const getApiBaseUrl = (): string => {
  if (isLocalHost(window.location.hostname)) {
    return trimTrailingSlash(window.location.origin);
  }

  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  return trimTrailingSlash(window.location.origin);
};

export const getWebSocketBaseUrl = (): string => {
  if (isLocalHost(window.location.hostname)) {
    return localWebSocketBaseUrl();
  }

  const configured = import.meta.env.VITE_WS_BASE_URL as string | undefined;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};
