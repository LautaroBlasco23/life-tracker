export const DEFAULT_TRACKED_DOMAINS = [
  "instagram.com",
  "twitter.com",
  "x.com",
  "discord.com",
  "reddit.com",
];

export const DEFAULT_API_HOST = "localhost:8080";

// floci (AWS emulator) API Gateway base URL for the refactored stack.
// background.js builds requests as `${host}/api`, so if this is used the
// gateway must route /api to the Lambda. Both paths remain supported: the
// old local backend (localhost:8080) stays the default above.
export const FLOCI_API_GATEWAY = "http://localhost:4566/execute-api/lifetracker-api/dev";
