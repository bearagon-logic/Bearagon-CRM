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

test("modal layers cover navigation and keep narrow-window gutters", async () => {
  const css = await readCssTree(path.join(root, "dist"));
  const interaction = await readFile(path.join(root, 'app/interaction-theme.css'), 'utf8');
  assert.match(interaction, /dialog-overlay'[\s\S]*?z-index: 80/);
  assert.match(interaction, /dialog-content'[\s\S]*?z-index: 90/);
  assert.match(interaction, /select-content'[\s\S]*?z-index: 100/);
  assert.match(css, /max-width:calc\(100vw - 32px\)!important/);
  assert.match(css, /max-height:calc\(100dvh - 32px\)/);
  assert.match(css, /z-index:90/);
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

test("sidebar decoration is bottom anchored, fades upward and cannot intercept navigation", async () => {
  const source = await readFile(path.join(root, 'app/interaction-theme.css'), 'utf8');
  const css = await readCssTree(path.join(root, 'dist'));
  assert.match(source, /\.ops-sidebar \{ isolation: isolate; \}/);
  const decoration = source.match(/\.ops-sidebar::before \{([^}]+)\}/)[1];
  assert.match(decoration, /inset: auto 0 0/);
  assert.match(decoration, /pointer-events: none/);
  assert.match(decoration, /z-index: -1/);
  assert.match(decoration, /sidebar-celestial\.png/);
  assert.match(decoration, /center bottom \/ 100% auto no-repeat/);
  assert.match(decoration, /mask-image: linear-gradient\(to top, #000 0%, #000 18%, #0009 52%, transparent 100%\)/);
  assert.match(source, /@media \(max-width: 780px\) \{\s*\.ops-sidebar::before \{ display: none/);
  assert.match(source, /@media \(forced-colors: active\)/);
  // The CSS optimizer reverses an upward gradient into equivalent downward stops.
  assert.ok(css.includes('mask-image:linear-gradient(#0000 0%,#0009 48%,#000 82% 100%)'), 'Compiled fade remains transparent at top and opaque at bottom');
  const art = await readFile(path.join(root, 'public/sidebar-celestial.png'));
  assert.equal(art.subarray(1, 4).toString(), 'PNG');
  assert.equal(art.readUInt32BE(16), 724);
  assert.equal(art.readUInt32BE(20), 2172);
  assert.ok((await readFile(path.join(root, 'dist/client/sidebar-celestial.png'))).equals(art), 'Production asset matches the inspected artwork');
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

test("proposal service toggles scale compactly on desktop full screen with 5-column grid and 2-column workspace", async () => {
  const interaction = await readFile(path.join(root, "app/interaction-theme.css"), "utf8");
  const proposalCss = await readFile(path.join(root, "app/proposal.css"), "utf8");
  const companyExp = await readFile(path.join(root, "app/company-experience.css"), "utf8");

  // Use the available service-column width, including embedded company workspaces.
  assert.match(interaction, /@container proposal-services \(min-width: 900px\) \{\s*\.proposal-toggles \{\s*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/);

  // Compact card height
  assert.match(interaction, /\.proposal-toggles button \{\s*display: grid;\s*grid-template-rows: auto 1fr auto;\s*min-height: 84px;/);
  assert.match(proposalCss, /\.proposal-toggles button \{[^}]+min-height:84px/);

  // 1440px max-width workspace layout utilizing full desktop width
  assert.match(companyExp, /\.company-experience \.proposal-page>\.lane-body\{padding:0;max-width:1440px\}/);
  assert.match(proposalCss, /\.proposal-page \.lane-body \{ max-width: 1440px; \}/);

  // 2-column split workspace with companion summary sidebar
  assert.match(proposalCss, /@container proposal-layout \(min-width: 1100px\) \{\s*\.proposal-workspace-grid \{\s*grid-template-columns: minmax\(0, 1fr\) 320px;/);
  assert.match(proposalCss, /\.proposal-workspace-grid > \.proposal-summary-sidebar \{\s*position: sticky;\s*top: 20px;/);
});

test("Neon blue service selection tokens provide high contrast against navy text", async () => {
  const theme = await readFile(path.join(root, "app/semantic-theme.css"), "utf8");
  const interaction = await readFile(path.join(root, "app/interaction-theme.css"), "utf8");
  const rgb = hex => hex.match(/\w\w/g).map(part => parseInt(part, 16) / 255);
  const luminance = values => values.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  const token = name => theme.match(new RegExp(`--brand-neon-blue${name}: #(\\w{6})`))[1];
  const fg = theme.match(/--brand-neon-blue-foreground: #(\w{6})/)[1];
  const fgLum = luminance(rgb(fg));
  const tier = interaction.match(/\.proposal-toggles button\[aria-pressed='true'\] small \{\s*color: (?:var\(--brand-neon-blue-foreground, )?#(\w{6})/);
  assert.ok(tier, 'Selected tier label has a measurable foreground');
  const tierLum = luminance(rgb(tier[1]));
  const pill = interaction.match(/\.proposal-toggles button\[aria-pressed='true'\]>span \{\s*background: rgba\((\d+), (\d+), (\d+), ([.\d]+)\)/);
  assert.ok(pill, 'Selected status pill has a measurable background');
  const pillRgb = pill.slice(1, 4).map(v => Number(v) / 255), alpha = Number(pill[4]);

  const stops = ["-highlight", "", "-deep", "-end"].map(name => rgb(token(name)));
  for (let i = 1; i < stops.length; i++) {
    for (let t = 0; t <= 100; t++) {
      const point = stops[i - 1].map((v, c) => v + (stops[i][c] - v) * t / 100);
      assert.ok(contrast(luminance(point), fgLum) >= 4.5, "Navy label contrast across neon blue gradient >= 4.5:1");
      assert.ok(contrast(luminance(point), tierLum) >= 4.5, "Tier label contrast across neon blue gradient >= 4.5:1");
      const pillPoint = point.map((v, c) => v * (1 - alpha) + pillRgb[c] * alpha);
      assert.ok(contrast(luminance(pillPoint), fgLum) >= 4.5, 'Included status pill contrast across the gradient >= 4.5:1');
    }
  }

  assert.match(interaction, /var\(--brand-neon-blue-highlight/);
  assert.match(interaction, /var\(--brand-neon-blue-foreground/);
});


test('work navigation preserves canonical destinations and identifies exactly one current view', async () => {
  const { WorkNavigation } = await vite.ssrLoadModule('/components/work-navigation.tsx');
  for (const current of ['/', '/communications', '/approvals', '/operations']) {
    const html=renderToStaticMarkup(React.createElement(WorkNavigation,{current}));
    assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
    assert.ok(html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0].includes('href="'+current+'"'));
    for(const label of ['Next actions','Inbox','Approvals','Operations'])assert.ok(html.includes(label));
  }
});
