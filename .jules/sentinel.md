## 2024-05-29 - [Weak Randomness]
**Vulnerability:** Weak random number generation using Math.random() for `runId` in scheduler.
**Learning:** `runId`s used for audit logging should be cryptographically secure, otherwise it could lead to potential collisions or be predictable.
**Prevention:** Use `crypto.randomBytes().toString('hex')` or `crypto.randomUUID()` when generating unique identifiers instead of `Math.random()`.

## 2025-02-27 - [Information Leakage in Error Responses]
**Vulnerability:** Internal database error messages were leaked to the frontend client in error responses (e.g., `details: err.message`).
**Learning:** Returning unhandled exception messages directly in API responses can leak sensitive database/infrastructure information to attackers.
**Prevention:** Ensure API endpoints return generic error messages (e.g., "Internal server error") and only log detailed exceptions securely on the server side using the application logger.
