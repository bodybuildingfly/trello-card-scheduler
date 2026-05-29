## 2024-05-29 - [Weak Randomness]
**Vulnerability:** Weak random number generation using Math.random() for `runId` in scheduler.
**Learning:** `runId`s used for audit logging should be cryptographically secure, otherwise it could lead to potential collisions or be predictable.
**Prevention:** Use `crypto.randomBytes().toString('hex')` or `crypto.randomUUID()` when generating unique identifiers instead of `Math.random()`.
