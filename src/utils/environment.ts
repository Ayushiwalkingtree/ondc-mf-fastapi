const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const isLocalHost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';

const localApiBaseUrl = (): string => {
  const protocol = window.location.protocol || 'http:';
  return `${protocol}//${window.location.hostname}:8000`;
};

const localWebSocketBaseUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:8000`;
};

export const getApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (isLocalHost(window.location.hostname)) {
    return localApiBaseUrl();
  }

  return trimTrailingSlash(window.location.origin);
};

export const getWebSocketBaseUrl = (): string => {
  const configured = import.meta.env.VITE_WS_BASE_URL as string | undefined;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (isLocalHost(window.location.hostname)) {
    return localWebSocketBaseUrl();
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};
