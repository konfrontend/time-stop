# Code Style

- No wrapper modules around a single library call; import the library where it is used.
- File names: camelCase for hooks and helpers, PascalCase for components and classes. Exception: files from an opinionated third-party library (e.g. shadcn) keep that library's own convention.
- A file whose main export is a single type or schema takes that export's PascalCase name (`Project.ts`, `SyncStatus.ts`). Kind files inside a concept folder (`rules.ts`, `inputs.ts`, `api.ts`, `index.ts`) stay lowercase.
