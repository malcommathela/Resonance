# Background Group Geometry Persistence — Investigation and Implementation Plan

**Repository:** `malcommathela/Resonance`  
**Target branch:** `dev`  
**Status:** Implementation specification; do not treat as an implementation or test result.  
**Scope:** Fix background-group position and size being lost or reverted when a design is saved, reloaded, or opened in another session.

---

## 1. Objective

Make background-group geometry durable and consistent across:

- creating, moving, resizing, collapsing, expanding, and renaming groups;
- manual save and autosave;
- navigating away from and reopening a design;
- refreshing the browser;
- opening the same design in a fresh browser session or on another device;
- concurrent or delayed save requests;
- legacy designs that may have group metadata only in browser storage.

The persisted group state must restore the intended **position, width, height, label, color, member IDs, and collapsed state** without relying on the browser that originally edited the design.

The server-side `Design.canvasMeta` field is the canonical persisted source for group metadata. Browser localStorage may be used only as a carefully bounded legacy migration/recovery source; it must not silently overwrite valid server state.

## 2. Strict guardrails

1. **Investigate before editing.** Read the current `dev` branch, inspect callers and tests, and confirm the current behavior. This document records findings from a remote code inspection, not a local test run.
2. **Do not redesign the canvas UI.** Keep existing group appearance, controls, drag behavior, resize affordances, layering, and interaction model.
3. **Do not rewrite or modify the simulation engine.** Groups are presentation-only and must remain outside simulation input.
4. **Do not replace the persistence architecture.** Extend the existing `Design.canvasMeta`, save queue, optimistic concurrency, and canvas hydration contracts.
5. **Do not solve this by adding another storage copy or new persistence key.**
6. **Do not weaken optimistic concurrency/version checks** to make a save appear successful.
7. **Do not silently discard geometry** when normalizing metadata. Invalid input must be handled explicitly and observably.
8. Avoid unrelated cleanup, broad refactors, new dependencies, or speculative UI changes.
9. Preserve backward compatibility for existing designs and legacy metadata shapes.
10. Do not claim completion until automated tests and manual reload scenarios below have actually passed.

## 3. Repository areas already identified

Verify exact current contents before implementation; line numbers and code may have changed.

### Web

- `apps/web/src/features/canvas/groups/meta.js`
  - Group geometry helpers such as `groupSize`, group-box expansion and metadata persistence/reading.
  - `persistCanvasMeta` / `readCanvasMeta` and normalization/extraction paths.
- `apps/web/src/features/canvas/groups/CanvasGroup.jsx`
  - React Flow group rendering, resize interaction and resize-commit lifecycle.
- `apps/web/src/stores/canvasStore.js`
  - `commitGroupResize`, `moveGroup`, `toggleGroupCollapse`, `loadDesign`, `loadCanvasMeta`, `applyServerGroups`, dirty state and revision updates.
- `apps/web/src/features/canvas/persistence/canvasPersistence.js`
  - `splitPersistable`, `saveCanvasPersistence`, `saveCanvasDocument`, save queue/version helpers.
- `apps/web/src/stores/designStore.js`
  - API save/autosave payload construction, server version handling, loading and save completion.
- Canvas editor and autosave hook/callers that load a design and connect persistence to the store.
- Existing group/persistence checks, including `apps/web/src/features/canvas/groups/meta.check.js` and `persistence.check.js` if present.

### API and database

- `apps/api/src/canvas/canvasMeta.js`
  - `normalizeCanvasMeta` and geometry field normalization.
- `apps/api/src/routes/designs.js`
  - GET design hydration and `syncCanvasData`, POST `/:id/canvas`, POST `/:id/autosave`, version checks, transaction and `Design.canvasMeta` write.
- `apps/api/prisma/schema.prisma`
  - Confirm the type and nullability of `Design.canvasMeta`.
- API tests and test scripts covering design load/save, metadata normalization, and version conflicts.

Search all call sites for `groupSize`, `normalizeCanvasMeta`, `commitGroupResize`, `moveGroup`, `persistCanvasMeta`, `readCanvasMeta`, `applyServerGroups`, `loadCanvasMeta`, `canvasMeta`, `groups`, and every canvas save endpoint. Do not assume the listed files are the only relevant callers.

---

## 4. Findings from initial inspection

### 4.1 Web group-size precedence can read stale geometry

The current group-size helper prefers `node.style.width/height` over React Flow's live top-level dimensions and `measured` dimensions. The existing self-check explicitly captures this precedence.

React Flow can update live dimensions during resize while `style` still reflects the creation-time dimensions. In `commitGroupResize`, reading the stale style first can make the commit logic believe the size did not change. The resize can then be skipped or the old dimensions can remain in the group object.

**Required:** determine which values represent the final committed geometry at the resize-stop boundary; explicitly commit those values into the durable geometry representation. Do not blindly reverse precedence everywhere without examining creation, collapsed, expanded, measured, and legacy nodes.

### 4.2 API normalization can preserve stale style dimensions

In `apps/api/src/canvas/canvasMeta.js`, the current dimension resolver checks `g.style[k]` before `g[k]` and `g.measured[k]`. Thus, if the request includes stale style dimensions plus current live dimensions, the API can normalize the stale values and persist them in `Design.canvasMeta`.

**Required:** establish and document one geometry contract shared by client and server. Normalize the final committed geometry, not an outdated rendering cache. Ensure style/live fields cannot disagree silently at the persistence boundary.

### 4.3 The server persistence route already exists

`apps/api/src/routes/designs.js` accepts `groups` or `canvasMeta`, normalizes it, prunes member IDs against block IDs from the same save, and stores metadata in the same transaction that updates the design version. The route also checks the expected version.

Do not replace this flow. Correct the geometry input and preserve the existing transaction, access checks, version conflict behavior, cache invalidation and audit logging.

### 4.4 Local storage is still written

The web persistence boundary describes localStorage as compatibility/migration only, but `saveCanvasPersistence` still calls `persistCanvasMeta`. The load flow includes server groups and local metadata compatibility behavior.

**Required:** trace all reads/writes and define exact precedence. Valid server metadata must win. Legacy local metadata must never overwrite a non-empty server result or resurrect a group that was deliberately deleted on the server. If local migration is still supported, make it explicit, one-time or otherwise idempotent, version-safe, and tested.

### 4.5 Hydration can be sensitive to load ordering

`applyServerGroups` currently adds groups not already present in the store and returns early for an empty list. That behavior may be appropriate for a late merge in some flows, but it is unsafe if used as the sole authoritative hydration operation when the store contains stale groups from a previous design/session or when the server explicitly contains zero groups.

**Required:** distinguish:
- authoritative initial hydration for a specific design/session;
- a non-authoritative merge, if one is genuinely needed;
- the legacy migration path.

An explicit server response containing zero groups must not be confused with “server metadata was not loaded.” Do not simply change `applyServerGroups` to always replace state without tracing every caller and ensuring the active design's blocks, edges, group membership and collapsed visibility remain consistent.

### 4.6 Position has not yet been proven to have an independent serializer defect

The API normalizer requires finite numeric `position.x` and `position.y`, and preserves them in normalized metadata. Initial inspection has not proved a separate position-normalization defect.

Trace `moveGroup` → Zustand state/dirty revision → immutable save snapshot → API payload → `Design.canvasMeta` → GET response → hydration. Verify there is no stale closure, omitted groups field, mismatched design ID, skipped dirty notification, or old save completion that masks newer geometry.

---

## 5. Canonical geometry contract

Agree on this contract before changing code and apply it consistently at every boundary.

### 5.1 Durable group record

Each persisted group must contain, at minimum:

- `id`: stable non-empty group ID;
- `type`: exactly `group`;
- `position`: finite numeric `x` and `y`;
- `style.width` and `style.height`: finite, positive, committed dimensions for a normal expanded group;
- `data.label`;
- `data.nodeIds`: unique member IDs, pruned only against the blocks in the same save;
- `data.collapsed`: explicit boolean when supported by the current contract;
- `data.color` when present.

Only durable properties belong in `canvasMeta`. Do not persist transient React Flow state such as `selected`, `dragging`, `resizing`, `measured`, selection state, or transient simulation/validation data.

### 5.2 Geometry authority

- During an active resize, React Flow's current dimensions may be transient/live.
- At resize completion, capture the actual final dimensions and commit them to the canonical group object.
- The committed canonical dimensions must be represented consistently in `style.width/height` (or the project's explicitly chosen durable field) before a save snapshot is made.
- API normalization must validate and persist the canonical committed values; it must not accidentally prefer a stale creation-time style value over a newer committed size.
- `width`, `height`, and `measured` are fallback evidence for legacy or in-flight objects, not competing durable authorities once canonical geometry is committed.
- When both canonical and fallback fields are present but disagree, resolve according to the documented lifecycle rule. Do not infer “latest” solely from which property happens to be present.
- Dimensions must be finite and within established project limits. Avoid zero/negative dimensions for expanded groups unless an existing, documented React Flow lifecycle requires a temporary zero; temporary values must never overwrite a valid persisted size.
- Collapsed groups need an explicit rule: persist the user's expanded dimensions separately if current behavior overwrites them with collapsed dimensions. On expand, restore that size, growing only when members no longer fit. Do not accidentally make the collapsed chip dimensions the permanent expanded size.

### 5.3 Position authority

- Persist the final group `position.x/y` after movement completes.
- Position values must be finite numbers; do not use truthiness fallbacks that convert legitimate zero coordinates to defaults.
- A group move should create the appropriate dirty/revision transition and save snapshot.
- Group and member movement must preserve the existing rigid-movement behavior and membership contract.

### 5.4 No groups versus groups not loaded

Represent these states distinctly in code:
1. Server metadata successfully loaded with `groups: []` — authoritative empty group list.
2. Server metadata successfully loaded with one or more groups.
3. Metadata not yet fetched / design load failed / old response unavailable.
4. Legacy local metadata available for migration.

Never use array length alone to determine whether the server response exists.

---

## 6. Required investigation before implementation

OpenCode must complete and record the following before editing.

### Phase 0 — Establish repository state and call graph

1. Confirm branch and working-tree status; do not discard uncommitted user work.
2. Read all files in Section 3 and inspect current test commands from package manifests.
3. Find every invocation of group creation, move, resize, collapse/expand, metadata serialization, hydration, save and autosave.
4. Trace whether group movement updates `revision`, `isDirty`, or both; compare resize and other node mutations.
5. Determine when `onResizeEnd`/resize stop fires relative to React Flow updating `width`, `height`, `measured`, and `style`.
6. Trace the exact GET design response shape and how `canvasMeta` is passed to the web store.
7. Trace request payloads for both manual save and autosave. Confirm they send all groups from the same immutable node snapshot as the blocks and edges.
8. Determine how a server response with no groups is represented: absent field, `null`, empty object, or `groups: []`.
9. Inspect all existing metadata and persistence tests; run relevant baseline tests before edits.
10. Produce a short findings table with file/function, observed behavior, evidence/test, and intended change.

**Stop condition:** do not begin implementation until the save/load path and resize event lifecycle are understood. If a claim in this document conflicts with current code, verify the current code and update the implementation plan rather than applying a blind patch.

### Phase 1 — Reproduce and isolate

Create a minimal reproducible scenario using one group and at least one architecture block:

1. Create group.
2. Record its ID, position, style dimensions and live dimensions.
3. Resize it to an unmistakably different width and height.
4. Record the group object immediately before and after the resize commit.
5. Observe whether the store revision and dirty flag change.
6. Inspect the outgoing manual-save/autosave request payload.
7. Inspect the normalized metadata immediately before database write.
8. Inspect the persisted `Design.canvasMeta` and GET response.
9. Reopen and compare restored geometry.

Repeat with a move-only operation. Record evidence for size and position independently so one does not mask the other.

Use test fixtures or a local test database. Do not modify production data for diagnosis.

---

## 7. Implementation phases

### Phase 2 — Correct and centralize geometry normalization

Files likely involved:
- `apps/web/src/features/canvas/groups/meta.js`
- `apps/api/src/canvas/canvasMeta.js`
- associated tests/checks.

Tasks:

1. Define a small, explicit geometry normalization policy. Keep it pure and deterministic.
2. Ensure the client resize-stop handler captures the final dimensions from the actual resize event/current React Flow node, not an earlier render closure.
3. Commit final width/height into the canonical group object before the persistence snapshot is constructed.
4. Fix `groupSize`/related helpers so their use is lifecycle-aware. Do not globally prefer live dimensions if that would cause a stale measurement to override a valid committed size after hydration.
5. Fix API `normalizeCanvasMeta` to consume the documented canonical dimensions first and use legacy/in-flight fallback fields only under explicit rules.
6. Ensure normalization preserves finite `position.x/y`, including zero and negative canvas coordinates.
7. Ensure normalization strips transient fields and retains the existing payload size, maximum-group and member-count limits.
8. Preserve existing color/label/member/collapsed normalization behavior unless a tested defect requires a narrowly scoped correction.
9. Keep client and API normalization semantics aligned; add contract fixtures demonstrating the same input produces the same durable geometry.
10. Do not silently accept conflicting dimensions without a deterministic resolution. Add a regression test for stale `style` plus newer live dimensions.

Acceptance criteria:
- A resize from an existing size to a different size commits the exact intended dimensions.
- No-op resize does not create unnecessary history or dirty changes.
- An invalid transient dimension cannot replace a valid persisted dimension.
- Existing valid persisted geometry remains stable through repeated normalize/serialize cycles.

### Phase 3 — Fix resize/move commit lifecycle

Files likely involved:
- `apps/web/src/features/canvas/groups/CanvasGroup.jsx`
- `apps/web/src/stores/canvasStore.js`
- `apps/web/src/features/canvas/core/canvasCommands.js`
- any resize/move hooks found in Phase 0.

Tasks:

1. Verify how the resize component passes starting geometry to the commit action.
2. Capture the resize-start size and the actual final size without relying on stale closure state.
3. At resize end, commit final position and size atomically to the group node.
4. If member overflow expansion adjusts group position or size, include that final expanded geometry in the same commit.
5. Avoid a commit being skipped merely because stale `style` matches the original size.
6. Make move and resize update the persistence dirty/revision mechanism consistently with the existing architecture. Avoid incrementing revision twice for one user gesture unless existing history semantics require it.
7. Ensure history/undo records the true pre-gesture dimensions and position and redo restores the final geometry.
8. Preserve the existing rule that moving a group moves its members by the same delta, with outsiders untouched.
9. Preserve existing layer order, drag handle, selection behavior, and group controls.
10. Verify the React Flow node-change handler does not overwrite committed geometry immediately after resize completion.

Acceptance criteria:
- Store state immediately after the gesture matches the visible geometry.
- Save starts only after the canonical group state is updated.
- Undo and redo restore the correct dimensions and position.
- Moving or resizing a group does not accidentally change membership or unrelated nodes.

### Phase 4 — Make save snapshots carry canonical group state

Files likely involved:
- `apps/web/src/features/canvas/persistence/canvasPersistence.js`
- `apps/web/src/stores/designStore.js`
- autosave/editor hooks.

Tasks:

1. Verify `saveCanvasDocument` and the design store use one immutable snapshot for blocks, edges and groups.
2. Ensure the group list is derived from the exact same snapshot as the blocks used for member pruning.
3. Ensure both manual save and autosave send the explicit groups/canvas metadata field expected by the API.
4. Verify group-only edits (move, resize, rename, collapse/expand, membership changes) schedule a save.
5. Verify the save queue serializes writes per design and uses the correct expected server version.
6. Keep revision-safe clean behavior: an older completion must not mark a newer edit clean.
7. Keep conflict handling intact. A foreign version conflict must not blindly retry by overwriting a newer server state.
8. Do not mark a design clean until the server confirms that exact snapshot was saved and the response is still applicable to the active design/session.
9. Do not let a design switch or late response mutate the next design's state.
10. Remove localStorage writes from the normal authoritative save path if the investigation confirms they are unnecessary; otherwise document their narrow migration purpose and ensure they cannot become a competing authority.

Acceptance criteria:
- Request payload contains current group position and canonical dimensions.
- Group-only edits persist even if no architecture block changed.
- Save completion for an older revision cannot clear dirty state for a newer one.
- No new localStorage value can overwrite newer server geometry.

### Phase 5 — Make hydration authoritative and session-safe

Files likely involved:
- `apps/web/src/stores/canvasStore.js`
- `apps/web/src/stores/designStore.js`
- `apps/web/src/features/canvas/persistence/canvasPersistence.js`
- design editor load route/hooks.

Tasks:

1. Trace the full load lifecycle and define an authoritative hydration entry point for a specific design ID/session generation.
2. Load blocks and edges and apply server group metadata in a deterministic order that avoids transient duplicate groups and stale memberships.
3. Distinguish “server returned zero groups” from “metadata has not loaded.”
4. On authoritative hydration, do not retain groups from the previously opened design. Clear/replace group state according to the active design's server record.
5. If `applyServerGroups` remains a merge helper, keep it separate from authoritative replacement and document the caller contract.
6. Reconstruct groups from `canvasMeta` without requiring localStorage to be present.
7. Validate group membership against the loaded block IDs and preserve intentional empty groups if that is the existing product contract.
8. Reapply collapsed visibility consistently to group members and affected edges without overwriting durable position/expanded dimensions.
9. Ignore stale hydration responses after the user switches designs.
10. Use localStorage migration only when the server truly lacks metadata under a verified legacy condition. Do not treat a valid server `groups: []` as missing data.
11. If a migration save is needed, make it explicit, idempotent, version-safe, and observable; do not silently write local-only data over a newer server record.

Acceptance criteria:
- Reload restores the exact server-saved geometry with localStorage cleared.
- Opening design B after design A does not retain A's groups.
- A server-authoritative empty group list clears stale groups.
- A late response for an older design cannot affect the active design.
- Legacy designs still load without losing valid local-only groups, subject to a safe migration path.

### Phase 6 — API persistence contract and safeguards

Files likely involved:
- `apps/api/src/canvas/canvasMeta.js`
- `apps/api/src/routes/designs.js`
- API tests.

Tasks:

1. Confirm the save route receives the full intended group list for every save.
2. Keep `normalizeCanvasMeta` pure and testable.
3. Persist only normalized canonical geometry in `Design.canvasMeta`.
4. Preserve the existing transaction that writes blocks/edges and metadata atomically and increments the design version.
5. Preserve expected-version conflict responses and access checks.
6. Preserve the rule that omitted metadata from an older client does not erase stored groups, if this compatibility contract is intentional. Explicit `groups: []` must continue to mean delete all groups when accompanied by a valid version.
7. Ensure the web client sends an explicit groups field when it intends to replace group state.
8. Keep pruning group member IDs against block IDs from the same request, but do not drop groups solely because they are empty.
9. Check all GET endpoints used by the editor and confirm the required metadata is present in the design detail response (not merely an overview response that the editor does not use).
10. Do not add a second group table or schema migration unless investigation proves the current JSON field cannot satisfy the requirements.

Acceptance criteria:
- POST save → database → GET round-trip preserves canonical geometry.
- Explicit empty list deletes groups; omitted metadata follows the documented compatibility rule.
- Stale expected versions return conflict without partial mutation.
- Invalid metadata returns a clear client error and does not partially save blocks/edges.
- Cache invalidation and existing audit behavior remain intact.

### Phase 7 — Remove or constrain competing local persistence

1. Search for all direct localStorage reads/writes related to group metadata.
2. Document the purpose and lifetime of the existing compatibility key.
3. Prefer server state whenever the server metadata field is present, including a valid empty list.
4. If a one-time migration is required, only run it when the server record is demonstrably legacy/missing, not merely empty.
5. Do not auto-merge conflicting server and local group geometry. If migration conflict handling is needed, server wins by default; migration must not resurrect intentionally deleted groups.
6. Remove unused paths only after tests show no remaining callers. Avoid unrelated removal of other canvas preferences or panel state.

### Phase 8 — Tests and regression verification

Extend existing test files where practical. Follow the repository's actual test framework and script names discovered in Phase 0; do not invent package scripts.

#### Geometry unit tests

- Style contains old dimensions while live top-level dimensions contain new dimensions.
- Style contains old dimensions while measured dimensions contain new dimensions, under the documented resize lifecycle.
- Canonical committed style matches final resize dimensions and is stable on repeated normalization.
- Zero and negative group positions round-trip unchanged.
- Missing, NaN, infinite, zero, negative, string and oversized dimensions are handled by documented rules.
- Collapsed dimensions do not destroy the expanded-size restore value.
- Normalization strips transient fields while preserving label, color, membership and collapsed state.
- Client/API fixtures produce the same durable geometry.

#### Store/component tests

- Resize commits final dimensions.
- Resize commit does not return early due to stale style.
- Move updates position and schedules persistence.
- No-op resize does not create duplicate history entries.
- Undo/redo restores pre/post geometry.
- Group movement moves only the group and its members.
- Collapse/expand round-trips while preserving expanded size.
- Deleting a member prunes membership but does not unintentionally delete the group.

#### Persistence/API tests

- Save payload includes all groups from the same immutable snapshot.
- Server normalizer persists the intended dimensions and position.
- Save → GET detail → hydration restores geometry.
- Same test passes with localStorage absent/cleared.
- Explicit server `groups: []` removes stale client groups.
- Missing metadata is distinguishable from a loaded empty list.
- Legacy local metadata migration does not overwrite server state or resurrect deleted groups.
- Group-only edit is saved and increments version.
- Stale expected version causes conflict and no partial mutation.
- A delayed save response does not clear a newer revision's dirty state.
- Switching designs during load/save prevents stale response application.
- Concurrent saves cannot cause the last persisted geometry to regress to an older snapshot.

#### Required end-to-end scenarios

1. **Resize + reload:** create group, resize to a distinctive dimension, wait for save success, hard-refresh, verify dimensions and position.
2. **Move + reload:** move group to a distinctive positive position, save, reopen and verify.
3. **Zero/negative position:** move group to coordinates including zero or a negative coordinate; save/reload and verify no truthiness/defaulting bug.
4. **Cross-session:** save in one browser session, open in a fresh session with local storage cleared, verify exact geometry.
5. **Design switching:** open design A with groups, then design B with no groups; B must not inherit A's groups.
6. **Collapsed group:** collapse, save, reload, expand; the original expanded dimensions should be restored.
7. **Race:** trigger two edits/saves close together and prove older state cannot win.
8. **Legacy:** load a design with legacy local metadata and verify migration behavior without overwriting valid server state.

### Phase 9 — Final audit

Before completion:

- Run targeted web metadata checks and persistence checks.
- Run API metadata and route tests.
- Run relevant typecheck/lint/build commands from the actual workspace scripts.
- Run the full applicable test suite if feasible; report any unrelated baseline failures separately.
- Inspect the final diff for unrelated UI, simulation, schema, or dependency changes.
- Confirm no simulation input or simulation logic consumes group nodes.
- Summarize files changed, root causes fixed, tests run and results, remaining limitations, and manual checks still required.

---

## 8. Definition of done

The work is complete only when all of the following are true:

- [ ] Resizing commits the actual final dimensions, not stale style values.
- [ ] Moving commits the actual final position, including zero/negative coordinates.
- [ ] Client and server use a documented, consistent geometry normalization contract.
- [ ] Canonical geometry is included in both manual-save and autosave snapshots.
- [ ] The server database record is the source of truth for normal design loading.
- [ ] Reloading with localStorage cleared restores the same group position and size.
- [ ] Reopening in a fresh session or device restores the same group position and size.
- [ ] Explicit empty server metadata does not accidentally preserve stale groups.
- [ ] Legacy migration cannot overwrite valid/newer server state or resurrect deleted groups.
- [ ] Collapse/expand, membership, undo/redo and concurrency behavior remain correct.
- [ ] Existing optimistic concurrency, access control, transactions and cache invalidation remain intact.
- [ ] Tests cover the reproduced bug and pass, with actual results reported.
- [ ] No canvas redesign, simulation rewrite, unrelated refactor, or unnecessary migration was introduced.

## 9. OpenCode execution instructions

Implement this document in phases, not as one broad rewrite.

At the beginning, inspect the current working tree and branch. Preserve user changes. In Phase 0, trace the real code and reproduce the issue before editing. For each phase:

1. State the root cause/evidence.
2. Make the smallest coherent code change.
3. Add or update regression tests before moving on.
4. Run the narrowest relevant tests immediately.
5. Review the diff and confirm guardrails were respected.
6. Continue only after the phase's acceptance criteria are met.

If the existing architecture differs from this document, stop and reconcile the plan with the actual code rather than forcing outdated assumptions. Never report a test as passing unless it was executed and passed. Do not claim a fix based only on a localStorage preview or a successful save response; prove a database-backed reload.

**Expected result:** background groups retain their exact committed size and position after save, reload, and reopening, with the server as the canonical source and no regressions to canvas interaction or simulation.
