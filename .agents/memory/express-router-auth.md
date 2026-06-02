---
name: Express router-level auth anti-pattern
description: router.use(requireAuth) without a path intercepts ALL routes when the router is mounted without a path prefix — blocks public endpoints.
---

## The Rule
Never use `router.use(requireAuth)` at the top of a sub-router when that router is mounted without a path prefix (e.g., `mainRouter.use(subRouter)`).

**Why:** In Express, `router.use(fn)` without a path matches every request path. When a sub-router is mounted without a prefix (`mainRouter.use(subRouter)` instead of `mainRouter.use('/appointments', subRouter)`), its middleware runs for ALL incoming requests — including requests meant for other routers like `/settings/public`.

**How to apply:** Always add `requireAuth` to each individual route handler:
```ts
// BAD — blocks everything:
router.use(requireAuth);
router.get("/appointments", handler);

// GOOD — selective:
router.get("/appointments", requireAuth, handler);
```

This affected `appointments.ts`, `financial.ts`, and `reports.ts` in this project, causing `/api/settings/public` to return 401.
