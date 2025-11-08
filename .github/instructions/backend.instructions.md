---
applyTo: "server/**/*
---

## Coding Style

### Backend

- TypeScript must be **strict**.
- Never use `any`.
  - Use `unknown` if needed.
  - Use `Record<string, T>` for generic objects.
- Avoid `Object` type.
- Use explicit types for all functions, arguments, and returns.
- Match existing code style (spacing, naming, file organisation, classes, validations, patterns used, design).
- Use clear interfaces and separation of repo/service layers.
- Add JSDoc comments, unit tests, and changelog entries where helpful.
- Comments should explain **why**, not **what** and be as short as possible while being understandable.
- Follow Clean Architecture, SOLID, and other standard OOP principles and design patterns.

---
