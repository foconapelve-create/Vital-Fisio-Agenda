---
name: Bearer token auth fallback
description: Why and how auth was changed to use Bearer tokens instead of cookies in this Replit project.
---

# Bearer token auth fallback

Replit's Canvas/preview embeds the app in an iframe. Modern browsers block third-party cookies in iframes — even with `SameSite=None; Secure`. Sessions were being created in the DB (`user_sessions` table) but the `Set-Cookie` response was never stored by the browser, so every `GET /api/auth/me` returned 401.

**Fix:**
- `app.ts`: Added middleware after `express-session` that reads `Authorization: Bearer <sessionId>` header, looks up the raw session from the PG store, and hydrates `req.session` manually.
- `auth.ts` login route: Returns `sessionId: req.sessionID` in the JSON response body.
- `apiFetch.ts`: Stores session ID in `localStorage` key `vf_session_id`; attaches it as `Authorization: Bearer` on every fetch.
- `App.tsx`: Calls `setAuthTokenGetter(getStoredSessionId)` so `api-client-react` hooks (e.g., `useGetMe`) also send the token.
- `login.tsx`: Uses `apiFetch` directly (not `useLogin`) to capture `sessionId` from response and persist it.
- `Sidebar.tsx` logout: Calls `setStoredSessionId(null)` to clear the token.

**Why:**
Third-party cookie blocking in iframes is the root cause. Bearer tokens in headers are unaffected by cookie policies.

**How to apply:**
Any new page that uses auth-gated API calls already works because `setAuthTokenGetter` is set globally in `App.tsx` and `apiFetch` always attaches the header. Logout always clears `localStorage`.
