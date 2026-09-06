
# Comment Conventions

Cross-language rules for code comments, complementing each language's own style rules.

- Comment only what the code cannot say: invariants, cross-module contracts, rationale, spec pointers. Never describe what a function or field visibly does.
- Inline comments (inside a function body, or above a statement or field) are short one-liners.
- Comments are evergreen: describe the constraint or behavior as it stands, never the incident, ticket, or history that motivated it. No ticket IDs in code comments — that context lives on the PR.
- Explanations that genuinely need multiple lines go at the method/class/function level (JSDoc, or a block comment above the declaration), not inline.
