# Services package UI review — September 12, 2026

The owner requested review and merge of the updated Antigravity branch `refine-services-package-ui`. Its original six-file working-tree diff is preserved in commit `bb04937423434965b8fa8ed0b1c5aac0b5619e92`. The review retains the compact controls, chartreuse illuminated service buttons, wider workspace and package-summary sidebar.

## Findings corrected

- Quick-jump anchors triggered the existing discard-unsaved-work confirmation even though they only scroll within the same document. Hash-only links now bypass that leave-page prompt; other links and before-unload protection keep their existing checks. Reproduced the original prompt and verified the corrected jump preserves the edited field and dirty status.
- The summary combined custom services with catalog selections but kept a catalog-only denominator, allowing totals above ten out of ten. It now reports the total number of included services, computes catalog tier denominators from the catalog, includes custom quick links, and labels selections as included rather than configured. Inclusion does not claim readiness.
- The viewport breakpoint squeezed five cards and a 320px sidebar into a laptop's available content area. Container queries now base the split layout on actual workspace width and five-column tiles on the actual service column. Narrower areas use three, two or one column. The sidebar becomes scrollable on wide layouts with space reserved for the existing footer; it is static when stacked. Sidebar actions use full-width rows.
- Legacy mobile navigation rules hid the new quick links and their text. Scoped sidebar rules keep them visible. Custom button labels can wrap and render above the decorative sheen.
- The dark translucent Included pill reduced the contrast provided by the underlying chartreuse gradient. A light translucent pill preserves navy text contrast; the gradient contrast test now includes the blended pill surface. Unlit tier labels are brighter. Reduced-motion selectors now also cover selected and custom controls.
- Internal-plan guidance no longer promises a pricing step that internal scopes skip. Restored a general disclosure-summary style and removed trailing blank lines.

## Validation

- TypeScript and production build passed; all 113 automated tests passed after the final changes.
- Targeted lint of `components/proposal-workspace.tsx` has the same three errors and three warnings, with the same rule sequence, as pre-existing main. These are existing hook/effect findings; no clean-lint claim. Test output also retains development-server port/dependency-scanning warnings; test assertions pass.
- Real components and model transitions were exercised through ignored fictional in-memory browser fixtures. Successful sidebar draft save retained the changed value and advanced the saved version. Save-and-continue reached Pricing for a client scope. A simulated failed save kept the edited field, dirty status and Services step.
- Accepted internal scopes kept all ten catalog buttons and the custom inclusion button disabled, exposed Continue without Save, and continued directly to Review without changing the saved version.
- Visual and computed-layout checks at 1920px, 1100px and 390px confirmed five/three/one tile columns respectively, no clipped tile content or document horizontal overflow, and the appropriate split/stacked workspace. Mobile quick-link visibility was rechecked after its fix. The initial 1280px candidate inspection exposed cramped cards and wrapping. These are local checks, not a production workflow audit.

No auth, API, storage, schema, provider, quote-transition or acceptance logic changed. No business database records were mutated. The existing untracked `AGENTS.md` and ignored fixtures stay outside the commits. Publication evidence belongs in the handbook after the deployment succeeds.
