# Canvas Persistence, Replica Semantics, Inspector, and AI Integration — Implementation Plan

**Target repository:** `malcommathela/Resonance`  
**Investigation branch:** `dev`  
**Investigation snapshot:** `b7fde4db78426a3ed4340bb2b3ffce146c34570c` (commit referenced by current `dev` code search results at investigation time)  
**Implementation mode:** OpenCode, phased, repository-first  
**Scope:** Fix durable canvas-group persistence, replica configuration semantics, node metadata visibility, inspector rendering, and cross-service/AI consistency.  
**Hard guardrails:** Do not redesign the canvas, do not rewrite the simulation engine, do not replace the existing canonical document/persistence boundaries wholesale, do not silently discard user data, and do not claim success without tests and deployed cross-device verification.

---

## 1. Executive summary

The current implementation has multiple persistence and contract gaps that interact:

1. **Canvas groups are still browser-local.** `apps/web/src/features/canvas/persistence/canvasPersistence.js` explicitly says group objects ride in localStorage compatibility keys; `apps/web/src/features/canvas/groups/meta.js` writes `resonance.canvas.meta.<designId>`. `useCanvasPersistence.js` reloads them from local storage after loading server blocks/edges. A second device/browser therefore cannot restore them.
2. **The database design contract has no canvas metadata field.** `apps/api/prisma/schema.prisma`'s `Design` model has blocks/edges and related records but no canvas metadata/document field. The canvas sync route persists blocks and edges, not groups.
3. **Groups are not in the AI design context.** `apps/api/src/chat/services/chatContext.js` queries blocks and edges, then builds the context from those records. It does not select persisted canvas groups. `buildDesignContextPrefix` in `apps/api/src/chat/prompts.js` only describes components and connections. AI cannot reliably reason about named group intent/membership today.
4. **AI cache invalidation depends on a revision that group edits do not update.** The context revision incorporates `Design.version`, latest simulation/report/optimization state. Browser-only group changes do not increment server `Design.version`; once groups become persisted, every successful metadata mutation must participate in versioning/invalidation.
5. **Replica concepts are defined separately in the property registry but must be verified end-to-end.** `propertyDefinitions.js` places `replicas` at `config.replicas` and `minReplicas`/`maxReplicas` at `config.behavioralModel.scalingBehavior.*`. That separation must survive editor state, API payloads, database serialization, server validation, simulation initialization/autoscaling, reports, and AI context.
6. **The node is deliberately compact and currently uses `w-[200px]`.** `ArchitectureNode.jsx` does not show port or replicas. Group geometry uses `NODE_W = 208` and `NODE_H = 72` in `groups/meta.js`; changing rendered dimensions without updating shared geometry can break group bounds and drop detection.
7. **The inspector still has a legacy generic configuration path.** The property registry says all inspector fields should come from explicit definitions, but `PropertyPanel.jsx` still has legacy/generic config rendering paths. The screenshot confirms duplicate labels for Port and Replicas. Fix field-label ownership once in the shared renderer; do not patch each field separately.
8. **The current test suite encodes the old local-only design.** `persistence.check.js` expects groups to ride a metadata side channel and `meta.check.js` tests geometry using 208×72. Replace obsolete expectations with tests for server persistence and keep pure geometry tests aligned with the actual node dimensions.

This is a cross-layer consistency sprint, not a cosmetic-only fix. Implementation is complete only when the same design, groups, replica values, validation, and AI interpretation remain consistent after reload, across devices, and through simulation/report flows.

## 2. Verified repository evidence

| Area | Evidence observed on `dev` | Consequence |
|---|---|---|
| Group storage | `groups/meta.js`: `persistCanvasMeta()` calls `localStorage.setItem(META_KEY(designId), ...)`; `readCanvasMeta()` reads it back. | Local browser storage is the source of truth for groups. |
| Persistence boundary | `canvasPersistence.js` says groups use localStorage compatibility keys; `saveCanvasPersistence()` writes metadata locally and `saveCanvasDocument()` then delegates to the existing save function. | Server saves cannot make groups portable. |
| Hydration | `useCanvasPersistence.js` loads design via `designStore.loadDesign()`, then calls `loadCanvasMeta(designId)`. | Groups are joined from the current device, not the server snapshot. |
| Database | `Design` in `apps/api/prisma/schema.prisma` has blocks, edges, simulations, reports, chat sessions and generations; no canvas metadata field. | A schema/migration and API contract change are required. |
| API write path | `apps/api/src/routes/designs.js` has `syncCanvasData()` which transactionally syncs blocks/edges and increments `Design.version`. | Add metadata to the same optimistic-concurrency/versioning contract; don't create an uncoordinated write path. |
| Node UI | `ArchitectureNode.jsx` uses `w-[200px]` and only displays name/type/status and actions. | Requested port/replica metadata is absent. |
| Geometry | `groups/meta.js` uses `NODE_W = 208`, `NODE_H = 72` for group bounds/drop targets. | Rendering and geometry must share one dimension contract or measured dimensions. |
| Property contract | `propertyDefinitions.js`: `replicas` is `config.replicas`; min/max are under `behavioralModel.scalingBehavior`. | Preserve these independent paths. |
| Inspector | `PropertyPanel.jsx` still contains generic/legacy configuration rendering while the registry/resolver exist. | Remove duplicate-label ownership conflict and prevent known fields from being rendered twice. |
| AI context | `chatContext.js` selects blocks/edges and constructs component/connection arrays. No group metadata is loaded. | AI group understanding must be added at the server context boundary. |
| AI prompt | `prompts.js` describes Components and Connections, not groups. | Prompt must explain groups are organizational canvas metadata, not simulated components. |
| AI cache | `contextRevision` is derived from design version and latest sim/report/optimization state. | Group writes must advance design version (or an explicit canvas-context revision) and invalidate cache keys. |
| Existing tests | `persistence.check.js` expects a `groups` side channel; `meta.check.js` assumes node geometry 208×72. | Update tests to reflect server-backed metadata and the final shared geometry contract. |

**Important:** These findings are based on repository files inspected on the investigation snapshot above. OpenCode must re-check the live branch head and every referenced call site before implementation; do not assume this document's snapshot is still the latest commit.

## 3. Required domain contracts

### 3.1 Canvas metadata

Persist group objects with the design on the server. Keep group metadata separate from simulation blocks/edges.

Recommended initial shape, subject to checking the existing API response conventions:

```ts
type CanvasMetadataV1 = {
  schemaVersion: 1;
  groups: Array<{
    id: string;
    type: 'group';
    position: { x: number; y: number };
    style?: { width?: number; height?: number; [key: string]: unknown };
    data: {
      label: string;
      color?: string;
      nodeIds: string[];
      collapsed?: boolean;
      memberCount?: number; // derived; do not trust as canonical
      [key: string]: unknown;
    };
  }>;
  // Add viewport only if the current product contract explicitly persists it.
};
```

- Groups are canvas presentation/organization objects, never simulation blocks.
- Group membership references block/node IDs; membership must be validated and pruned deterministically when blocks are deleted.
- Preserve unknown forward-compatible fields where safe, but validate the structure and cap payload size.
- Do not store transient selection, hover, validation results, simulation runtime metrics, or client-only panel state.
- Use one canonical representation. Avoid storing the same group list in both `Design.canvasMeta` and a separate unrelated endpoint/table unless investigation establishes a concrete need.
- A nullable PostgreSQL JSON/JSONB field on `Design` is a reasonable starting option for this small per-design metadata payload; verify the installed Prisma version and migration conventions first. If the repository's schema/migration architecture prefers a dedicated table, document why before choosing it.
- Do not use the Prisma 8 migration commands blindly: this repo currently uses the classic `schema.prisma` + `prisma migrate` workflow. Follow the exact installed Prisma version and existing migration layout.

### 3.2 Replica semantics

Keep the three fields independent and user-editable:

- `config.replicas`: the configured starting/deployment replica count. This is what the user sets in the inspector and what the node displays as the configured count.
- `config.behavioralModel.scalingBehavior.minReplicas`: lower autoscaling bound.
- `config.behavioralModel.scalingBehavior.maxReplicas`: upper autoscaling bound.

When autoscaling is enabled, simulation initializes from `replicas` and the autoscaler may change the **runtime** count within the configured min/max bounds. When autoscaling is disabled or the node's scaling type does not support horizontal scaling, do not pretend that min/max are actively applied. Do not overwrite configured `replicas` with a simulated runtime count.

For nodes where replicas are nonsensical (for example a singleton database model), follow the existing block-type capability contract. Do not expose generic replica controls on every node merely because the registry currently contains a general definition. If the simulator already models database scaling differently, preserve that behavior and validate the supported range by type.

Validation:
- integer values only;
- configured `replicas` must be at least 1 for replica-capable nodes;
- `minReplicas` and `maxReplicas` must be integers and respect the supported type-specific range;
- `minReplicas <= maxReplicas`;
- when horizontal autoscaling is enabled, require `minReplicas <= replicas <= maxReplicas` OR explicitly define a safe initialization/normalization policy. Preferred behavior: show an actionable validation error and do not silently mutate user input;
- for fixed/singleton scaling modes, validation must use type-specific semantics rather than enforcing irrelevant horizontal bounds;
- invalid configuration must be rejected consistently by client preflight, API validation, and simulation entry point.

Node UI must label the displayed value as configured replicas when no simulation is running. If live simulation count is shown, label it explicitly as current/runtime replicas and keep it visually distinct from the configured value.

### 3.3 Node dimensions and geometry

- Increase the rendered card from 200px to a modest 230–240px width only after checking canvas density and existing interaction controls.
- Show a compact metadata line using actual configured values, e.g. `:3000 · 3 replicas`.
- Omit a property when it is not defined or does not apply. Never invent a port or replica count solely to fill space.
- Keep name/type/actions legible and avoid turning nodes into full property panels.
- Replace hard-coded duplicated geometry with one shared sizing contract. Update `NODE_W`, `NODE_H`, group bounds, resize/expand calculations, group drop target center, fit-to-view assumptions, and geometry tests together. Prefer React Flow measured dimensions where safe; otherwise centralize constants and document why they are accurate.
- Test long labels, missing metadata, narrow viewport, selected state, validation highlight, and simulation-running state.

### 3.4 Inspector property ownership

The explicit property registry/resolver must be the only source of known properties. A known field must render once, with one label and one input.

- Port and Replicas labels must not be rendered both by a wrapper and by `ConfigInput`.
- `minReplicas` and `maxReplicas` belong to the Scaling/Behavior section, not a generic custom config list.
- `replicas` belongs to Deployment.
- Unknown legacy keys must be preserved and shown in an explicit Advanced/Legacy area; they must not duplicate known properties or be dropped during unrelated edits.
- Add/remove custom fields must not create keys that shadow known registry definitions.
- Ensure the field edit path preserves nested `behavioralModel.scalingBehavior` data rather than replacing sibling sections.
- Avoid changing the existing inspector navigation/layout beyond what's required for correctness.

## 4. Phased implementation plan

### Phase 0 — Rebase and inspect before edits

1. Fetch current `dev` and any active PR/branch state. Record exact HEAD SHA and working tree assumptions.
2. Read the complete current implementations and callers of:
   - `apps/web/src/features/canvas/persistence/canvasPersistence.js`
   - `apps/web/src/features/canvas/groups/meta.js`
   - `apps/web/src/features/canvas/hooks/useCanvasPersistence.js`
   - `apps/web/src/stores/canvasStore.js`
   - `apps/web/src/stores/designStore.js`
   - `apps/web/src/features/canvas/core/document.js`
   - `apps/api/prisma/schema.prisma`
   - `apps/api/src/routes/designs.js`
   - `apps/api/src/middleware/tenantContext.js`
   - `apps/web/src/features/canvas/nodes/ArchitectureNode.jsx`
   - `apps/web/src/components/canvas/PropertyPanel.jsx`
   - `apps/web/src/features/canvas/inspector/propertyDefinitions.js`
   - `apps/web/src/features/canvas/inspector/propertyResolver.js`
   - client/server validation, simulation normalization, reports, deployment export, and AI chat/generation/optimization routes/services.
3. Trace the exact payload from editor state → autosave/manual save → API route → Prisma → detail response → client hydration.
4. Trace replica values from property edit → canonical node config → API mapping/DB fields → simulation input normalization → runtime count/scaling → metrics/report → AI context.
5. List all consumers of `Design.version`, cache keys, `canvasMeta`, `replicas`, and `scalingBehavior`. Identify endpoint response shapes and any cache invalidation conventions.
6. Run existing relevant tests before changing code; capture failures as baseline, do not label pre-existing failures as regressions.
7. Search for any other localStorage group keys, old metadata APIs, group imports, duplicate config enumeration, stale TODOs, and shadowed replica fields.
8. Do not begin implementation until the call graph and migration path are documented in the OpenCode session notes.

**Exit gate:** a file/call-site map, baseline test report, and written migration/API contract exist.

### Phase 1 — Canonical server persistence for canvas metadata

1. Add a versioned nullable canvas metadata field or equivalent first-class table using the repo's existing Prisma migration workflow.
2. Add a safe, validated API contract for reading/writing canvas metadata. Prefer extending the existing design detail and canvas save contract so clients do not need a separate non-atomic request.
3. Persist blocks, edges, and canvas metadata in a transaction under the same design access/tenant checks and optimistic-concurrency version check. Group-only changes must also advance the relevant design/context version.
4. Avoid lost updates: use the current `Design.version` concurrency contract or introduce a separate `canvasVersion` only if a clear conflict policy is designed. Do not allow a stale tab to overwrite newer groups while preserving newer blocks, or vice versa.
5. Update GET design detail hydration and save responses to return the canonical metadata field consistently.
6. Validate metadata size/shape, IDs, positions, allowed group types, style dimensions, label length, color format if constrained, duplicate group IDs, duplicate member IDs, and references to existing blocks.
7. Keep metadata out of the block/edge tables and simulation input.
8. Ensure ownership/team write access is checked identically to normal design writes.
9. Invalidate design detail/overview caches and AI context caches after successful mutation. Ensure failed transactions do not invalidate as if saved.
10. Add migration tests and API tests for empty/null metadata, existing designs, invalid metadata, unauthorized access, version conflict, transaction rollback, and large payload limits.

**Migration policy for existing users:** localStorage data cannot be migrated automatically on another device. On the originating browser, implement a one-time, authenticated, idempotent migration: read the legacy key, submit groups to the server only if the server has no groups (or merge using an explicitly specified conflict policy), verify the server accepted the payload, then mark the migration complete and remove the legacy key only after confirmed success. Never overwrite server groups with stale local data on every load. If both server and local data exist and differ, preserve both until an explicit deterministic merge/conflict resolution is applied; do not silently drop either copy.

### Phase 2 — Autosave, concurrency, hydration, and recovery

1. Change `saveCanvasDocument` and the save pipeline so the snapshot includes blocks, edges, and canvas metadata; keep snapshot immutable.
2. Ensure autosave watches group-only mutations (create, rename, recolor, resize, collapse, move, membership add/remove, delete/ungroup). A group edit must mark the canonical document dirty and increment revision.
3. Ensure manual save and autosave call the same canonical persistence path.
4. Update `loadDesign` hydration to restore server groups before marking the document hydrated/clean. Do not briefly initialize an empty group list that can autosave over the loaded data.
5. Ensure switching designs, failed loads, and in-flight save completions cannot cross-contaminate the active design. Reuse the existing session-generation and per-design queue contracts.
6. Ensure version conflicts protect groups and blocks as one document. Present the existing conflict UI; do not retry foreign writes blindly.
7. Remove localStorage as the authoritative read/write path after the one-time migration is proven. Keep only a narrowly scoped migration reader and device-local preferences where appropriate.
8. Update `persistence.check.js` so it tests API payload composition and server metadata rather than asserting that groups are a local side channel.
9. Test rapid group edits, edits during in-flight saves, navigation mid-save, reload during pending autosave, server errors, offline/timeout recovery, cross-tab conflicting edits, and same-design multi-device updates.

### Phase 3 — Replica contract across UI, API, database, simulation, and reports

1. Verify whether the database's dedicated `Block.replicas` field is actually written/read consistently with `Block.config.replicas`. The current design context selects both `replicas` and `config`; establish one canonical source and a compatibility rule for legacy rows.
2. Do not silently let the top-level DB column and JSON config disagree. Prefer canonical config semantics or a deliberate synchronized mapping; document and test precedence for legacy data.
3. Verify that nested `config.behavioralModel.scalingBehavior.minReplicas/maxReplicas` survives JSON serialization, API normalization, and save/load unchanged.
4. Add one shared pure replica validator/normalizer where feasible in `packages/shared`, used by client/server validation without importing browser-only modules. Keep validation side-effect free.
5. Keep client validation advisory; enforce authoritative validation at API/simulation boundary too. A client-only error is not a security/correctness boundary.
6. Confirm simulation starts from configured `replicas`; capacity math applies replica count exactly once (not both pre-scaled capacity and replica multiplier); autoscaling modifies only runtime replica state and remains inside valid bounds.
7. Check behavior for unsupported/vertical/singleton types (e.g. database), disabled autoscaling, min=max, initial count at either boundary, high load, low load, cooldowns, and failed replicas.
8. Ensure simulation results persist both input configuration/version and runtime observations needed to explain scaling. Do not overwrite the design's configured replicas with runtime results.
9. Ensure report generation and recommendations distinguish configured count, min/max bounds, and observed runtime count.
10. Check deployment/export paths (Docker Compose/Kubernetes or other supported exports) for correct use of configured replicas and scaling bounds; do not generate unsupported fields for services that cannot use them.

Required invariants for horizontally autoscaled, replica-capable blocks:
- configured replicas, min, max are integers;
- `1 <= minReplicas <= maxReplicas`;
- `minReplicas <= replicas <= maxReplicas`;
- runtime replicas remain within bounds at every simulation step;
- changing any one field does not silently mutate another;
- autoscaling-disabled runtime remains fixed at configured replicas except for explicitly modeled failures/recovery;
- invalid configuration blocks simulation with a stable finding code and actionable message.

If the existing simulator intentionally allows the configured initial count to start outside the scaling bounds and clamps it, do not preserve that behavior by accident. Make a product-level contract decision during Phase 0, document it, and test it. The default plan is to reject invalid configuration visibly rather than silently clamp.

### Phase 4 — Inspector and custom fields

1. Trace every path that renders known properties in `PropertyPanel.jsx`; remove duplicate rendering paths rather than hiding individual labels with CSS.
2. Ensure the property registry/resolver owns labels, paths, types, visibility, parsing, and validation for known fields.
3. Ensure `ConfigInput`/shared field controls own exactly one label (or accept an explicit `showLabel` contract that is used consistently).
4. Port and Replicas each render one label and one input in Deployment.
5. Min Replicas and Max Replicas render once in Scaling/Behavior, not under generic Custom.
6. Unknown legacy config fields remain editable/preserved in Advanced without duplicating registry-owned fields.
7. Add custom fields with unique non-reserved keys; prevent collisions with `port`, `replicas`, `behavioralModel`, and all registry-defined paths.
8. Validate numeric input without silently clamping invalid user values at blur if that hides configuration errors. Display a clear inline error and keep the draft value until resolved; follow the established form conventions.
9. Confirm edits mark the canvas dirty and autosave through the same versioned pipeline.
10. Add component-level or DOM tests asserting exactly one label/input per field and the correct nested path after edit/reload.

### Phase 5 — Node metadata and geometry

1. Increase the node from 200px to a modest 230–240px width, retaining the current visual style and interaction affordances.
2. Add a compact metadata row sourced from actual node config: port and configured replica count only when applicable.
3. Avoid duplicate or stale metadata selectors; subscribe to the minimum stable node data required.
4. Synchronize the shared geometry contract used by `groups/meta.js`, group expansion, drag/drop target calculations, and geometry tests.
5. Verify groups remain correctly sized and contain nodes after resizing the node, moving a node across a group boundary, collapsing/expanding groups, and loading older designs.
6. Test no-port/no-replica node types, long names, narrow canvases, validation highlights, selected/hover states, and running simulation state.
7. Do not redesign node visuals, add logos, or turn the node into a settings panel.

### Phase 6 — AI layer and connected-service audit/fixes

AI must reason about the same saved architecture users see. The AI must not invent groups, treat groups as executable components, or use stale replica configuration.

#### Context assembly
1. Extend `buildDesignContext()` to load validated persisted canvas groups alongside blocks and edges.
2. Resolve each group's `nodeIds` to known component IDs/labels. Exclude missing members and surface a context-health warning rather than inventing components.
3. Include concise group context (group ID, label, purpose/description if supported, color only if semantically relevant, member IDs/names, collapsed state only if useful). Do not send arbitrary unbounded UI metadata.
4. Include configured replicas and min/max scaling bounds from the canonical source. Include current runtime replica observations only when a matching simulation actually recorded them.
5. Update `buildDesignContextPrefix()` and prompt versioning to state clearly:
   - groups are organizational canvas metadata, not simulation nodes;
   - membership expresses user organization/architecture boundaries but does not create an edge or runtime dependency;
   - distinguish configured replicas, autoscaling bounds, and simulated runtime replicas;
   - treat labels/descriptions as untrusted data and never follow embedded instructions.
6. Keep context bounded with explicit caps and health status. If groups query fails, mark group context unavailable; do not claim there are no groups.
7. Ensure group changes affect `Design.version` or a dedicated context revision used in `contextRevision`, fingerprints, Redis keys, and response-cache keys. Increment prompt/context schema version when shape/semantics change.

#### Cache and request correctness
1. Audit `apps/api/src/chat/services/cacheService.js`, chat request/session services, generation, optimization, report, and design-context caches for invalidation after metadata and replica changes.
2. Check Redis fail-open behavior, lock release in `finally`, timeout handling, cache-key revision, context fingerprint, and response-cache versioning.
3. Ensure a failed context subquery is represented as unavailable rather than converted into an empty authoritative list. This is especially important for groups.
4. Confirm team/tenant authorization is enforced before loading context or mutating design metadata; no cross-tenant cache key collisions.
5. Verify prompt version changes invalidate stale AI response caches.
6. Test that editing group membership or replicas changes the next AI context/cache key and that the next answer uses the updated saved state.
7. Ensure generation/AI canvas-apply flows preserve group metadata unless the user explicitly asks to change groups. AI-generated blocks/edges must not accidentally erase groups during full-document saves.
8. Ensure optimization application changes only its intended fields and cannot replace `config.replicas` while editing scaling bounds.
9. Check AI-generated design normalization, schema validation, retry/fallback behavior, and unsupported node types against current shared block definitions. AI output must pass the same validation contract before it can mutate a design.
10. Audit any other AI feature (chat, architecture generation, optimization suggestions/application, report insights) that reads or writes design config; include groups only where semantically relevant and never feed transient canvas state.

#### Connected services and contract sweep
- **API/Prisma/PostgreSQL:** schema, migration, transactional writes, detail reads, ownership/team access, cache invalidation, optimistic concurrency.
- **Frontend stores/hooks:** canonical document, dirty/revision tracking, autosave/manual save, hydration, session switching, local migration.
- **Shared package:** property definitions/contracts, validation utilities, simulation model defaults, serialization helpers.
- **Simulation API/engine:** input filtering excludes groups; replica initialization/bounds/capacity applied exactly once; runtime metrics distinguish from configured values.
- **Reports/metrics:** accurate replica terminology and matching design/simulation versions.
- **AI chat/context/prompts/cache:** group awareness, current replica values, version/fingerprint invalidation, bounded untrusted context.
- **AI generation/optimization:** schema and property compatibility; group preservation; no conflicting writes.
- **Export/deployment:** configured replica count and supported scaling fields are mapped correctly.
- **Redis/cache:** invalidation and fail-open behavior after successful writes.
- **Auth/team tenancy:** consistent access control on metadata endpoints and context.
- **Observability:** structured logs and actionable errors; no secrets/config credentials leaked into AI context or logs.
- **CI/deploy:** migration ordering, Prisma client generation, API/web/shared package builds, environment parity.

Do not attempt to fix unrelated findings opportunistically in this sprint. Record unrelated bugs in a follow-up list with evidence, severity, affected path, and a regression test proposal. Fix any discovered issue that directly breaks these contracts or creates data loss, stale AI context, security exposure, or simulation misrepresentation.

### Phase 7 — Legacy migration and rollout

1. Ship additive DB schema and backward-compatible API reads/writes first.
2. Deploy API/schema migration before relying on the new field in the web client.
3. Ship client support for server-backed metadata and one-time localStorage migration.
4. Monitor migration successes/failures and metadata payload validation.
5. Only after evidence shows the migration is safe, remove the legacy localStorage writer/reader and obsolete tests.
6. If a rollback is needed, the old client must not be allowed to overwrite server metadata from stale local data. Keep rollout/rollback behavior explicit.
7. Test against a production-like copy with existing designs, empty groups, groups with deleted members, and conflicting local/server data.

### Phase 8 — Verification, regression suite, and release gate

Run existing repository checks and add focused tests. Use the actual scripts in `package.json`; do not invent command names if scripts differ.

#### Required automated coverage

**Persistence/API**
- create design → create group → save → reload → group survives;
- edit group only → design/context version advances;
- second browser/device loads the same group IDs, labels, dimensions, colors, collapsed state, and membership;
- create/rename/recolor/resize/collapse/move/membership edit/delete all autosave;
- manual save and autosave share payload semantics;
- unauthorized and cross-team access rejected;
- stale version returns conflict without partially applying blocks, edges, or groups;
- transaction failure rolls back the entire document;
- migration is idempotent; legacy local data is removed only after confirmed server success;
- server metadata wins over stale local metadata unless explicit conflict resolution says otherwise.

**Replica semantics**
- edit `replicas` and verify only `config.replicas` changes;
- edit min/max and verify only nested scaling behavior changes;
- invalid integer/fraction/zero/negative/range values rejected consistently;
- min greater than max rejected;
- initial count outside bounds rejected for autoscaling mode;
- singleton/vertical scaling types follow their supported contract;
- save/reload preserves values and type;
- simulation starts with configured count and runtime count remains distinct;
- capacity is multiplied by replica count once;
- scale-up/down respects thresholds, increments, cooldowns, and bounds;
- report and AI distinguish configured and runtime count.

**Inspector/node UI**
- exactly one Port label/input and one Replicas label/input;
- exactly one Min Replicas and Max Replicas control in scaling section;
- custom fields cannot shadow known properties;
- port/replica metadata renders only when present;
- geometry/group membership math matches actual card dimensions;
- no regression to node selection, rename, add/duplicate controls, handles, highlights, or group drag/resize.

**AI**
- context includes groups and resolved member names;
- group changes and replica edits invalidate context and response cache;
- failed group query reports unavailable, not “no groups”;
- group labels containing prompt-like instructions are treated as untrusted data;
- groups are never passed to simulation input or described as runtime components;
- AI generation/optimization preserves groups unless explicitly changed;
- latest simulation/report IDs remain matched; AI does not attribute an old report to a newer run;
- no credentials/secrets enter context through arbitrary config/custom fields;
- tenant isolation and authorization tests cover context and mutation endpoints.

**Cross-service**
- Prisma migration deploys on an existing database with existing designs;
- Prisma client generation succeeds;
- shared package, API, and web build/type/lint checks pass;
- API integration tests, shared pure checks, and end-to-end tests pass;
- Vercel/API production deployment reports healthy; inspect logs for migration, schema, cache, and context errors;
- perform the real two-device verification before closing the sprint.

#### Required manual acceptance walkthrough

1. On device A, open an existing design, create two background groups, set labels/colors/dimensions, place nodes in them, and save.
2. Change a service to 4 configured replicas; set min=2 and max=8; verify no field changes another.
3. Confirm node shows the actual port and “4 replicas”.
4. Reload device A; confirm all values persist.
5. Open the same design on device B/incognito; confirm groups, group membership, node positions, port, replica count, and scaling bounds match.
6. Ask Resonance AI to summarize the architecture and explain group membership and scaling configuration; verify it uses the latest saved state and clearly distinguishes configured from runtime replicas.
7. Run simulation; verify group objects do not become simulation blocks, replica count is applied once, autoscaling respects bounds, and report values match the simulation run.
8. Edit a group and a replica value, immediately trigger AI again; verify the context/cache reflects the new design version.
9. Test stale tab conflict; verify no silent data loss.
10. Review browser console, API logs, Redis/cache logs, and database migration status.

**Release gate:** no phase is considered complete based only on code inspection or unit tests. Attach command output/test results, migration evidence, and a cross-device walkthrough record to the PR.

## 5. Known risk areas and required audit questions

These are investigation targets, not claims that every item is already broken:

1. **Dual replica storage:** `Block.replicas` versus `Block.config.replicas`. Determine which writes/reads each and eliminate contradictory values.
2. **Nested config visibility in AI:** `chatContext.js` has a bounded root-level `CONFIG_KEYS` allowlist; verify min/max nested values are intentionally projected rather than silently omitted.
3. **Context query failure semantics:** current per-query resilience turns failed subqueries into `null`/empty arrays. Ensure group failure is distinguishable from no groups.
4. **Cache versioning:** make sure every successful metadata/replica mutation changes the context revision and all response caches use it.
5. **Autosave races:** group-only edits currently bypass server versioning; include them in the same immutable snapshot and conflict policy.
6. **Migration precedence:** avoid stale local groups overwriting the server copy.
7. **Group membership integrity:** deletion/duplication of blocks must update group member IDs without deleting groups unexpectedly.
8. **Geometry drift:** UI width 200px vs geometry width 208px is already inconsistent enough to require a single sizing contract; update group bounds and tests together.
9. **Simulation capacity math:** verify replica count is applied exactly once across capacity calculations; don't change physics beyond fixing demonstrable contract violations.
10. **Custom field shadowing:** unknown config keys must not override or duplicate canonical fields.
11. **Generated/optimized designs:** any AI or optimization full-document write must preserve canvas metadata.
12. **Version/cache side effects:** ensure a metadata-only update invalidates design detail, overview, and AI context caches without incorrectly marking a simulation/report as newer.
13. **Existing migration conventions:** inspect installed Prisma version and deployment workflow before selecting migration syntax.
14. **Error reporting:** errors must be actionable, structured, and must not expose secrets or raw prompts.

## 6. Explicit non-goals

- No canvas redesign or new visual language.
- No replacement of React Flow, Zustand, or the current canonical document boundary.
- No rewrite of the simulation engine or recalibration of simulation model constants.
- No group-as-simulation-node behavior.
- No broad schema cleanup unrelated to these fixes.
- No automatic clamping or silent rewriting of replica fields.
- No silent data deletion during local-to-server migration.
- No AI prompt changes without prompt/cache version updates and tests.
- No declaring the project bug-free after a narrow targeted audit; report all additional findings with evidence and severity.

## 7. Required PR deliverables

- A short architecture decision note for canvas metadata storage and migration precedence.
- DB migration and API contract tests.
- Updated client persistence/hydration and legacy migration.
- Shared replica validation/normalization contract with tests.
- Inspector duplicate-label fix and node metadata row with geometry tests.
- AI context/prompt/cache updates and tests.
- Simulation/report/export integration checks without simulation rewrite.
- A bug audit table: finding, evidence/path/line, severity, affected service, fix or follow-up issue, regression test.
- Test/build/migration results and two-device acceptance evidence.
- PR description explicitly listing what was verified versus what remains unverified.

## 8. Reference files

- `apps/web/src/features/canvas/persistence/canvasPersistence.js`
- `apps/web/src/features/canvas/groups/meta.js`
- `apps/web/src/features/canvas/hooks/useCanvasPersistence.js`
- `apps/web/src/features/canvas/core/document.js`
- `apps/web/src/stores/canvasStore.js`
- `apps/web/src/stores/designStore.js`
- `apps/web/src/features/canvas/nodes/ArchitectureNode.jsx`
- `apps/web/src/components/canvas/PropertyPanel.jsx`
- `apps/web/src/features/canvas/inspector/propertyDefinitions.js`
- `apps/web/src/features/canvas/inspector/propertyResolver.js`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/routes/designs.js`
- `apps/api/src/chat/services/chatContext.js`
- `apps/api/src/chat/prompts.js`
- `apps/api/src/simulation/validation.js`
- `packages/shared/simulation-models.js`
- `apps/web/src/features/canvas/persistence/persistence.check.js`
- `apps/web/src/features/canvas/groups/meta.check.js`

## 9. OpenCode execution instruction

Read this document fully. Re-investigate the current repository HEAD and every referenced call site before editing. Produce a concise evidence-backed audit table and baseline test report first. Then implement the phases in order, updating this document with actual paths, migration names, commands, test results, and any deviations. Stop and explain any conflict with existing architecture rather than inventing a replacement. Do not mark a phase complete until its acceptance criteria pass. Keep changes narrowly scoped to durable canvas metadata, replica semantics, inspector/node presentation, and the connected-service/AI contracts described here.
