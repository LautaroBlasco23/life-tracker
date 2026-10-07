import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import manifest from "./manifest.json";

describe("manifest.json", () => {
  it("is a valid MV3 manifest", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("declares a module service worker that exists on disk", () => {
    expect(manifest.background?.service_worker).toBe("background.js");
    expect(manifest.background?.type).toBe("module");
    expect(
      existsSync(fileURLToPath(new URL("./background.js", import.meta.url)))
    ).toBe(true);
  });

  it("points the action popup at existing files", () => {
    expect(manifest.action?.default_popup).toBe("popup.html");
    expect(
      existsSync(
        fileURLToPath(new URL(`./${manifest.action.default_popup}`, import.meta.url))
      )
    ).toBe(true);
  });
});

describe("background.js ESM smoke", () => {
  it("imports the shared tracker lib via relative ESM imports", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./background.js", import.meta.url)),
      "utf8"
    );
    expect(src).toContain('from "./lib/tracker.js"');
  });

  it("tracker lib imports cleanly under Node ESM (no chrome globals at module top level)", async () => {
    const mod = await import("./lib/tracker.js");
    expect(typeof mod.buildApiUrl).toBe("function");
    expect(typeof mod.matchDomain).toBe("function");
    expect(typeof mod.isTrackedHost).toBe("function");
    expect(typeof mod.normalizeDomainInput).toBe("function");
  });
});
