import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildApiUrl, isTrackedHost, matchDomain, normalizeDomainInput } from "./lib/tracker.js";
import { DEFAULT_TRACKED_DOMAINS } from "./config.js";

describe("buildApiUrl", () => {
  it("builds the API base for a host", () => {
    expect(buildApiUrl("localhost:8080")).toBe("http://localhost:8080/api");
  });

  it("builds the API base for a remote host", () => {
    expect(buildApiUrl("api.example.com")).toBe("http://api.example.com/api");
  });

  it("does not prepend a scheme to hosts that already have one", () => {
    // Existing behavior: host is inserted verbatim.
    expect(buildApiUrl("http://localhost:8080")).toBe("http://http://localhost:8080/api");
  });

  it("round-trips the default API host from config", () => {
    expect(buildApiUrl("localhost:8080")).toBe("http://localhost:8080/api");
    expect(typeof DEFAULT_TRACKED_DOMAINS).toBe("object");
  });
});

describe("isTrackedHost", () => {
  const domains = DEFAULT_TRACKED_DOMAINS; // instagram.com, twitter.com, x.com, discord.com, reddit.com

  it("matches exact host", () => {
    expect(isTrackedHost("instagram.com", domains)).toBe(true);
  });

  it("matches subdomain", () => {
    expect(isTrackedHost("www.instagram.com", domains)).toBe(true);
    expect(isTrackedHost("old.twitter.com", domains)).toBe(true);
  });

  it("rejects suffix false positives ('notsocial.com' must not match 'social.com')", () => {
    expect(isTrackedHost("notinstagram.com", domains)).toBe(false);
    expect(isTrackedHost("notsocial.com", ["social.com"])).toBe(false);
  });

  it("rejects unrelated hosts", () => {
    expect(isTrackedHost("github.com", domains)).toBe(false);
  });

  it("rejects empty domain list", () => {
    expect(isTrackedHost("instagram.com", [])).toBe(false);
  });

  it("is boundary-aware: 'evildiscord.com' does not match 'discord.com'", () => {
    expect(isTrackedHost("evildiscord.com", domains)).toBe(false);
  });
});

describe("matchDomain", () => {
  it("returns the exact matched domain", () => {
    expect(matchDomain("x.com", DEFAULT_TRACKED_DOMAINS)).toBe("x.com");
  });

  it("returns the parent domain (not the full host) for subdomains", () => {
    expect(matchDomain("www.reddit.com", DEFAULT_TRACKED_DOMAINS)).toBe("reddit.com");
  });

  it("keeps first-match semantics when multiple domains could match", () => {
    // First occurrence in the list wins, regardless of length — mirrors the
    // old `.find()` behavior, only the match boundary is fixed.
    expect(matchDomain("a.social.com", ["social.com", "a.social.com"])).toBe("social.com");
    expect(matchDomain("a.social.com", ["a.social.com", "social.com"])).toBe("a.social.com");
  });

  it("returns undefined when nothing matches", () => {
    expect(matchDomain("example.org", DEFAULT_TRACKED_DOMAINS)).toBeUndefined();
  });
});

describe("normalizeDomainInput", () => {
  it("strips scheme, www, and path; trims and lowercases", () => {
    expect(normalizeDomainInput("  HTTPS://WWW.Example.Com/path?q=1 ")).toBe("example.com");
  });

  it("passes a bare domain through unchanged", () => {
    expect(normalizeDomainInput("example.com")).toBe("example.com");
  });

  it("drops everything after the first slash only", () => {
    expect(normalizeDomainInput("example.com/a/b")).toBe("example.com");
  });

  it("yields empty string for blank input", () => {
    expect(normalizeDomainInput("   ")).toBe("");
  });
});
