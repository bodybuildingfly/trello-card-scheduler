## 2024-05-18 - Parameter Injection and SSRF in API integration
**Vulnerability:** Trello API integration endpoints used string interpolation (`${apiKey}`) for URL path parameters and query arguments, which can be vulnerable to parameter injection and Server-Side Request Forgery (SSRF) if input is not properly encoded.
**Learning:** String interpolation for URLs in Axios requests allows potentially malicious payloads to manipulate the URL path or inject unintended query parameters.
**Prevention:** Always use native Axios `params` for query arguments, and `encodeURIComponent()` for user-provided values embedded directly in URL paths.
