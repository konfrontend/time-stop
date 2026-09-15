# Feature-driven folder structure for components — source survey

Question: in a React + TS SPA (Electron renderer, Vite, shadcn/ui, TanStack Router/Query), where do established feature-based structures put (1) generic UI primitives, (2) components tied to a business entity and used by several features (Project color label, Project combobox, Record edit popover shared by two pages), (3) page/feature-specific composed components? Does any approach put "entity" folders next to "feature" folders, and with what import rules?

Primary sources only. Quotes kept short; everything else paraphrased with a link. Sources read 2026-09-15:

- FSD docs, rendered at feature-sliced.design, source `feature-sliced/documentation@0a2423e` (`main`).
- bulletproof-react `alan2207/bulletproof-react@9506629` (`master`).
- shadcn/ui docs, source `shadcn-ui/ui@2b3e6d4` (`main`, `apps/v4/content/docs`).
- React: `reactjs/react.dev@f7f4524` and legacy.reactjs.org.

## Answer at a glance

| | (1) Generic UI primitives | (2) Entity-bound UI reused by several features/pages | (3) Page/feature-specific composed UI | Entities + features side by side? |
|---|---|---|---|---|
| **FSD** | `shared/ui` | `entities/<entity>/ui` (appearance; logic via props/slots), or `features/<action>/ui` when it is a reused *interaction* | `pages/<page>/ui` (default); `features/<x>/ui` only if reused across pages | Yes. `entities` below `features`; strictly-downward imports; no same-layer cross-imports (except `@x` on entities) |
| **bulletproof-react** | `src/components` (e.g. `components/ui`) | Not addressed as a category; no entity layer | `src/features/<feature>/components` | No. Only `components` (shared) and `features`; no cross-feature imports, compose in `app` |
| **shadcn/ui** | `components/ui` by default (configurable via `aliases.ui`); code is yours to edit | Not addressed | Not addressed | Not addressed |
| **React docs** | No opinion | No opinion | No opinion | Not addressed |

## 1. Feature-Sliced Design (FSD)

### Structure

Three levels: **layers → slices → segments** ([Overview](https://feature-sliced.design/docs/get-started/overview)).

- **Layers** (top → bottom): `app`, `processes` (deprecated), `pages`, `widgets`, `features`, `entities`, `shared` ([Layers](https://feature-sliced.design/docs/reference/layers)).
- **Slices**: folders inside a layer, partitioned by business domain. `app` and `shared` have no slices, only segments ([Slices and segments](https://feature-sliced.design/docs/reference/slices-segments)).
- **Segments**: group by technical purpose. Conventional names `ui`, `api`, `model`, `lib`, `config`. Segment names should describe purpose, not essence; `components`, `hooks`, `types` are called out as bad names ([Slices and segments](https://feature-sliced.design/docs/reference/slices-segments); same point in [Desegmentation](https://feature-sliced.design/docs/guides/issues/desegmented), which flags `features/delivery/ui/components` as an anti-pattern).

### Import rules

- **Import rule on layers**: a file in a slice may import only slices on layers *strictly below* ([Layers § Import rule](https://feature-sliced.design/docs/reference/layers#import-rule-on-layers)). So `features/aaa` cannot import `features/bbb`, but can import `entities` and `shared`.
- `app` and `shared` are exceptions: made of segments that import each other freely (same page).
- **Public API rule**: every slice (and every segment on `app`/`shared`) exposes a public API; outside code imports only that, never internal files ([Slices and segments § Public API rule](https://feature-sliced.design/docs/reference/slices-segments#public-api-rule-on-slices)). The tutorial suggests one index per segment in `shared` (e.g. `shared/ui/index`) and one index per slice elsewhere ([Tutorial](https://feature-sliced.design/docs/get-started/tutorial)).
- **Cross-imports** (same layer, different slice) are a code smell ([Cross-imports](https://feature-sliced.design/docs/guides/issues/cross-imports)):
  - `entities`: `@x` notation (`entities/A/@x/B.ts`, a public API of A just for B) is allowed. The reference says to use it **only on the Entities layer** ([Public API § cross-imports](https://feature-sliced.design/docs/reference/public-api#public-api-for-cross-imports)); the Cross-imports guide calls it a last resort and suggests merging over-split entities first.
  - `features`/`widgets`: four strategies. A: merge slices. B: push shared *domain logic only* down to `entities`, UI stays in features/widgets. C: compose in `pages`/`app` via render props / children / DI. D: if unavoidable, import only another feature's public API. Strictness is a team decision.
  - FAQ: pages/features/entities can be combined, but composition must happen in a higher layer; one feature must not import another directly ([FAQ](https://feature-sliced.design/docs/get-started/faq)).

### Where each kind of component goes

**(1) Generic UI primitives → `shared/ui`.** Described as the app's UI kit. No business logic, but business-*themed* is fine (logo, page layout), and components with UI logic (autocomplete, search bar) are allowed ([Layers § Shared](https://feature-sliced.design/docs/reference/layers#shared)). Tutorial examples: buttons, modal dialogs, form inputs. Code in Shared is usually extracted during development rather than planned up front ([Tutorial](https://feature-sliced.design/docs/get-started/tutorial)).

**(2) Entity-bound UI reused across pages → `entities/<entity>/ui`, or `features/<action>/ui`.**
- An entity slice may hold `model` (storage, validation schemas), `api` (entity requests) and `ui`, the entity's visual representation. That UI doesn't have to be a complete block; its purpose is reusing the same appearance across pages, with business logic attached through props or slots ([Layers § Entities](https://feature-sliced.design/docs/reference/layers#entities)). A display-only piece like a Project color label matches this description.
- Features are the main user interactions. Reuse on several pages is the stated signal that something should be a feature. A feature slice may contain the interaction UI (e.g. a form), its API calls, state/validation, and flags ([Layers § Features](https://feature-sliced.design/docs/reference/layers#features)). An edit popover shared by two pages matches this (an interaction reused on several pages).
- FSD does not name "entity picker/combobox" specifically. The docs don't settle whether a selector counts as entity UI or a feature.
- FAQ: an entity is a real-life concept the app works with; a feature is an interaction that gives users value, the thing they do *with* entities ([FAQ](https://feature-sliced.design/docs/get-started/faq)).

**(3) Page-specific composed UI → `pages/<page>/ui`.** A page slice has no size limit while it stays navigable. A UI block that isn't reused can stay inside the page slice ([Layers § Pages](https://feature-sliced.design/docs/reference/layers#pages)). The Widgets layer is for reusable composed UI blocks, but see below.

### Widgets: guidance differs between the live site and the source

- **Source on `main`** (layers.mdx, overview.mdx): has a caution that the guide *discourages* the Widgets layer, because widgets that handle user flows overlap with features. Screen-specific compositions stay in `pages`. A reused user action plus its UI goes to `features`. Business-free UI goes to `shared`. App-wide layouts go to `app`.
- **Rendered site at time of reading** (feature-sliced.design/docs/reference/layers): older wording. Widgets are most useful when reused across pages or when a page has several large independent blocks. A block that is most of a page and never reused should not be a widget. Widgets can be full router blocks or page layouts.
- Both versions agree: a non-reused page block is not a widget.

### Small-app guidance

- You don't need every layer. Most projects have at least `shared`, `pages`, `app` ([Layers](https://feature-sliced.design/docs/reference/layers)). The basic example in the [Overview](https://feature-sliced.design/docs/get-started/overview) has only those three.
- FSD fits projects of any size. If the current architecture already works, switching may not be worth it ([Overview § Is it right for me](https://feature-sliced.design/docs/get-started/overview#is-it-right-for-me)).
- **v2.1 "pages first"**: start with pages and possibly stop there. Keep most UI and logic in each page with a reusable base in `shared`, and move logic lower only when several pages need it ([Migration v2.0→v2.1](https://feature-sliced.design/docs/guides/migration/from-v2-0)). The Steiger linter rules `insignificant-slice` (an entity/feature used by one page should merge into that page) and `excessive-slicing` enforce this.
- **Entities are optional**: having no `entities` layer is fine and doesn't break FSD. Thin clients likely don't need one. Decompose later rather than up front, don't make an entity for every piece of business logic, keep plain CRUD in `shared/api`, and design isolated entity contexts so cross-imports aren't needed ([Excessive entities](https://feature-sliced.design/docs/guides/issues/excessive-entities)).
- Features: not everything needs to be one. Too many slices bury the important ones ([Layers § Features](https://feature-sliced.design/docs/reference/layers#features)).

### Stack-specific FSD guides

- **Electron** ([Usage with Electron](https://feature-sliced.design/docs/guides/tech/with-electron)): `src/main` (features/entities/shared only; no pages/widgets), `src/renderer` (full layer stack), root `src/shared` for code common to both (IPC contracts), `src/app` with the main/preload/renderer entrypoints. A new `ipc` segment is suggested. A process may not import another process's modules; only `src/shared` is public to both.
- **TanStack Query** ([Usage with TanStack Query](https://feature-sliced.design/docs/guides/tech/with-react-query)): query factories/keys live either in `shared/api` (optionally split per controller) or, *if the project already has entities* and each request maps to one entity, in `entities/<entity>/api`. Related entities use `@x`. Keep mutations separate from queries: either a hook in the `api` segment near where it's used (e.g. `pages/x/api`), or `mutationFn` from `shared`/`entities` used inside the component.
- TanStack Router: no FSD guide found (the docs tree has Next.js, Nuxt, SvelteKit, Astro, Electron, TanStack Query).

## 2. bulletproof-react

Source: [docs/project-structure.md](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md), reference app [apps/react-vite](https://github.com/alan2207/bulletproof-react/tree/master/apps/react-vite).

### Structure

- `src/app` (routes, app.tsx, provider, router), `src/components` (components shared across the whole app), `src/features` (feature modules), and shared `hooks`, `lib`, `stores`, `types`, `utils`, `config`, `assets`, `testing`.
- Most code should live under `features`. A feature may have `api`, `assets`, `components`, `hooks`, `stores`, `types`, `utils`, only the folders it needs.
- Shared API calls: sometimes more practical in a dedicated top-level `api` folder when features share many calls.
- No barrel files: they can hurt Vite tree shaking. Import files directly.

### Import rules

- Avoid cross-feature imports. Compose features at the application level. Enforced with `import/no-restricted-paths` zones, one per feature ([.eslintrc.cjs](https://github.com/alan2207/bulletproof-react/blob/master/apps/react-vite/.eslintrc.cjs)).
- Unidirectional flow **shared → features → app**: `features` can't import `app`; shared modules (`components`, `hooks`, `lib`, `types`, `utils`) can't import `features` or `app`.
- In the reference app this is how composition works: route `app/routes/app/discussions/discussion.tsx` imports both `features/discussions` and `features/comments`, and neither feature imports the other.

### Where each kind of component goes

- **(1) Generic primitives → `src/components`**. The reference app has `components/ui/{button,dialog,drawer,dropdown,form,link,md-preview,notifications,spinner,table}`, plus `components/layouts`, `components/errors`, `components/seo`.
- **(2) Entity-bound UI shared by several features: not addressed.** The docs have no entity concept. Given the rules, the only two places that satisfy them are `src/components` (shared) or composition in `app`. The docs don't say which. In the reference app, entity *types* live in shared `src/types/api.ts` (`User`, `Discussion`, `Comment`).
- **(3) Feature-specific components → `src/features/<feature>/components`.** Route-level composition lives in `src/app/routes`.
- Entities next to features: no. Only `components` (shared) and `features`.

### Related component guidance

[docs/components-and-styling.md](https://github.com/alan2207/bulletproof-react/blob/master/docs/components-and-styling.md):
- Colocate components, functions, styles, and state as close to their use as possible.
- For larger projects, build abstractions around shared components as a component library, but find the repetition before abstracting. Wrapping 3rd-party components is also suggested.
- shadcn/ui is listed as a code-distributed, customizable library. Nothing on where it lives beyond `components/ui` in the reference app.
- Small-app guidance: none beyond "only include the folders a feature needs" and "for larger projects" on component libraries.

## 3. shadcn/ui

- **Location**: the CLI places components using `components.json` aliases. `aliases.ui` sets the install directory for `ui` components and can be customized (docs example: `@/app/ui`). Other aliases: `components`, `lib`, `hooks`, `utils` ([components.json](https://ui.shadcn.com/docs/components-json)). The Vite install guide imports from `@/components/ui/button` ([Vite](https://ui.shadcn.com/docs/installation/vite)).
- **Meant to be edited**: shadcn/ui describes itself as not a component library but the way you build yours. You get the component source ("Open Code"). To change behavior you edit the component directly instead of wrapping it. Upstream fixes come through the headless dependencies; the top layer stays open for modification ([Introduction](https://ui.shadcn.com/docs)).
- **Re-adding**: `shadcn add` doesn't overwrite existing files by default (`-o/--overwrite`, default false). `--diff` shows a file diff ([CLI](https://ui.shadcn.com/docs/cli)). `shadcn migrate` (icons, rtl, radix) rewrites files in the `ui` directory in place.
- **Not addressed**: feature/entity folders, where app-specific compositions of shadcn components go, whether non-shadcn generic components share `components/ui`.

## 4. React official docs

- **react.dev**: no file/folder-structure guidance. The only related line is on "Build a React app from scratch": routes can be configured in code or derived from component folder/file structure ([react.dev](https://react.dev/learn/build-a-react-app-from-scratch)).
- **Legacy docs FAQ "File Structure"** ([legacy.reactjs.org/docs/faq-structure.html](https://legacy.reactjs.org/docs/faq-structure.html), archived, not carried into react.dev): React "doesn't have opinions on how you put files into folders". It describes group-by-feature/route and group-by-file-type, says "feature" granularity is up to you (use users' mental model), advises against deep nesting (max 3–4 levels), and says not to spend more than five minutes choosing. Colocate files that change together. Larger projects often mix both approaches.
- Entities vs features: not addressed.

## Gaps

- No source picks a location for a *selector* component bound to an entity (combobox/picker). FSD's definitions fit both `entities/*/ui` (appearance, logic via props) and `features/*/ui` (reused interaction). bulletproof-react has no entity bucket.
- No source addresses TanStack Router file-based routes vs FSD `pages` directly.
- The FSD Widgets guidance on the rendered site is older than the source repo.
