import assert from "node:assert/strict";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { '@': root } },
  cacheDir: path.join(root, ".vite-test-cache", "rendered"),
  server: { middlewareMode: true, hmr: { port: 24679 } },
});

after(async () => {
  await vite.close();
});

test("publishes private Bearagon Ops metadata", async () => {
  const { metadata } = await vite.ssrLoadModule("/app/layout.tsx");

  assert.equal(metadata.title.default, "Bearagon Ops");
  assert.equal(metadata.applicationName, "Bearagon Ops");
  assert.equal(metadata.robots.index, false);
  assert.equal(metadata.robots.follow, false);
  assert.equal(metadata.openGraph, undefined);
  assert.equal(metadata.twitter, undefined);
});
