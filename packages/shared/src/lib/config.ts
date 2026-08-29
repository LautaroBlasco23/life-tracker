interface Config {
  apiUrl: string;
}

declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_API_URL?: string;
    };
  }
}

const FALLBACK_API_URL = 'http://localhost/api';

let apiUrlOverride: string | undefined;

/**
 * Platform override for the API base URL. Native apps call this once at
 * startup; web keeps using the runtime-injected window.__ENV__ mechanism.
 */
export const setApiUrl = (url: string): void => {
  apiUrlOverride = url;
};

export const getConfig = (): Config => {
  if (apiUrlOverride) {
    return { apiUrl: apiUrlOverride };
  }

  if (typeof window === 'undefined') {
    return { apiUrl: process.env.NEXT_PUBLIC_API_URL ?? FALLBACK_API_URL };
  }

  return {
    apiUrl:
      window.__ENV__?.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      FALLBACK_API_URL,
  };
};
