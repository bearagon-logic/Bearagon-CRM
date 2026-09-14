# Appearance modes

Added September 14, 2026 at the owner's request. Appearance in the sidebar opens immediate Light, Dark and Plaid previews. Light remains the default. The validated choice is saved as `bearagon-appearance` in this origin's local storage; animation is saved separately as `bearagon-ambient`. No account, company or permission data is modified. A pre-paint bootstrap restores the preference; blocked storage falls back safely. Changes sync to other tabs on the same origin.

Dark uses a midnight/slate palette. Plaid uses indigo, cyan and pink, with an original city backdrop, route-specific district labels, a clickable Cipher, a cassette B-side and the classic up/up/down/down/left/right/left/right/B/A code. The code is ignored while typing in fields or dialogs. Its four-second reveal only changes lounge decoration. Star drift is optional and respects reduced motion; no audio or rapid flashing.

`app/appearance.css` owns semantic tokens and new mode-specific styling. `scripts/generate-appearance-css.mjs` generates scoped legacy palette overrides from the styles imported by layout (including local CSS imports). It preserves the legacy cascade, resets and breakpoints. It runs in the normal verified build; after changing legacy styles, run it before a direct Windows fallback build. Do not edit the generated file manually. Check new surfaces and status contrasts visually when adding styles. The ordinary Light styles remain the source of layout truth.

## Original artwork

Asset: [plaid-city.png](../public/plaid-city.png). Generated with the built-in image generation tool and copied into the project; the original generation is retained outside the repository. No third-party game art is used.

Prompt: Original retro-futuristic neon city at night; angular buildings with electric cyan edges and magenta signs without readable text; huge striped pink sun, violet mountains, reflective grid highway converging at the center, and a tiny armored bear watching from a lower-right rooftop. Midnight indigo, hot pink and cyan; spacious starry upper sky and low skyline; premium digital illustration with subtle haze. Decorative dashboard backdrop, restrained dark contrast, no logos or watermark.

Validation: preference bootstrap/invalid values/blocked storage/animation restoration and palette contrast tests; TypeScript; visual review of company cards, theme dialog, approval queue, directory, walkthrough and mobile menu using fictional fixtures. Data mutations in real Ops were not needed for appearance validation.
