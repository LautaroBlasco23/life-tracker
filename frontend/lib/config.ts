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

export const getConfig = (): Config => {
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
