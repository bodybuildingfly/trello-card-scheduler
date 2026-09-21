## 2024-05-29 - [O(n^2) Database Aggregation Bottleneck]
**Learning:** Found an O(n^2) bottleneck when fetching all schedules. Instead of using a `JOIN` or aggregating properly in SQL, the application fetches all schedules and all checklist items, and then filters the checklist items in a nested loop in JavaScript for every schedule. This pattern scales poorly as schedules and checklist items grow.
**Action:** Always group related child arrays using a hash map lookup (O(1)) instead of `.filter()` (O(N)) when merging two large query results in the backend.
## Performance Optimizations
- Replaced N+1 single row insertions for `checklist_items` with a single parameterized batch insertion.
- When performing batch inserts into PostgreSQL using pg, calculate parameterized bindings dynamically (e.g., `VALUES ($1, $2), ($3, $4)`) taking care to increment indices (`const base = index * 2;`). Ensure to pass flattened parameters array (`flatParams`).
## 2024-11-20 - [Network Request N+1 Bottleneck]
**Learning:** Found an N+1 network request bottleneck when creating checklist items for Trello cards in `createTrelloCard`. The application was iterating sequentially over each checklist item and waiting for each individual HTTP POST request to complete. This introduces significant latency which scales linearly with the number of checklist items.
**Action:** Always use `Promise.all` to batch and parallelize independent external API calls. This reduces the latency of N operations to roughly the time of a single operation.
