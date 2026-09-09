import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  cacheDir: path.join(root, ".vite-test-cache", "ui"),
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: { port: 24680 } },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the Ops automation and responsive workspace styles", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /\.automation-page\{/);
  assert.match(css, /\.workflow-card\{/);
  assert.match(css, /\.state\.active\{/);
  assert.match(css, /\.client-workspace-tabs\{/);
  assert.match(css, /@media\s*\(width<=780px\)/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("ships visible action variants and tactile service choices", async () => {
  const css = await readCssTree(path.join(root, "dist"));
  assert.ok(/\.bg-primary\{background-color:#145d86\}/.test(css), 'Primary utility must compile with a real brand color');
  assert.match(css, /data-variant[=\"']+default/);
  assert.match(css, /data-variant[=\"']+outline/);
  assert.match(css, /\.proposal-action-next/);
  assert.match(css, /\.proposal-toggles button\[aria-pressed/);
  assert.match(css, /prefers-reduced-motion/);
  const { Button } = await vite.ssrLoadModule("/components/ui/button.tsx");
  for (const variant of ['default', 'outline']) {
    const html = renderToStaticMarkup(React.createElement(Button, { variant, disabled: true }, 'Save'));
    assert.match(html, new RegExp(`data-variant="${variant}"`));
    assert.match(html, /disabled=""/);
  }
});

test("Ember selection tokens retain readable white text throughout the gloss", async () => {
  const theme = await readFile(path.join(root, 'app/semantic-theme.css'), 'utf8');
  const interaction = await readFile(path.join(root, 'app/interaction-theme.css'), 'utf8');
  const css = await readCssTree(path.join(root, 'dist'));
  const rgb = hex => hex.match(/\w\w/g).map(part => parseInt(part, 16) / 255);
  const luminance = values => values.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const token = name => theme.match(new RegExp(`--brand-ember${name}: #(\\w{6})`))[1];
  const stops = ['-highlight', '', '-deep', '-end'].map(name => rgb(token(name)));
  for (let i = 1; i < stops.length; i++) {
    for (let t = 0; t <= 100; t++) {
      const point = stops[i - 1].map((v, c) => v + (stops[i][c] - v) * t / 100);
      assert.ok(1.05 / (luminance(point) + .05) >= 4.5, 'White label contrast across gradient');
    }
  }
  const soft = luminance(rgb(token('-soft'))), ink = luminance(rgb(token('')));
  assert.ok((soft + .05) / (ink + .05) >= 4.5, 'Ember text on pale accent surface');
  assert.match(css, /--brand-ember:#b84323/);
  assert.match(interaction, /service-inclusion-toggle\[aria-pressed='true'\]/);
  assert.match(interaction, /service-inclusion-toggle:not\(:disabled\):hover \{ filter: none/);
  assert.doesNotMatch(interaction, /#348c80|#247568|#13594f|#206e61/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});
