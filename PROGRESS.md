# Build Progress

## Status: PHASE 6 IN PROGRESS

## Phase 1 — Foundation
- [x] Monorepo skeleton — pnpm workspaces, tsconfig, package.json files
- [x] Docker Compose — Postgres 16 (port 5433 locally, 5432 internal), Redis 7, OpenFGA
- [x] Prisma schema — full data model from poc-scope.md
- [x] Initial migration — `20260506094951_init`
- [x] /lib — db, redis, secrets, logger, sentry
- [x] Core Backend entry point — Fastify, all 8 module stubs registered
- [x] GET /health endpoint
- [x] .env.example files for all apps

## Phase 2 — Core Backend Modules
- [x] Auth module — Part 1: JWT infrastructure + session management (Session 2.1)
- [x] Auth module — Part 2: OIDC + SAML + IdP management (Session 2.2)
- [x] Apps module
- [x] Schema module
- [x] Registry module
- [x] Registry seed script — all primitives

## Phase 3 — Execution Layer
- [x] Endpoint registry module
- [x] Connector module
- [x] Assets module
- [x] Action logs module

## Phase 4 — Shared Packages
- [x] /packages/core — all types + Zod schemas
- [x] /packages/ui — Part 1: Layout + Action + Feedback + Typography primitives (Session 4.2)
- [x] /packages/ui — Part 2: Display + Data + Input primitives (Session 4.3)
- [x] /packages/action-runtime — ActionExecutor + FormManager + EventBus (Session 4.4)

## Phase 5 — App Builder
- [x] Next.js setup + FDE auth + app list (Session 5.1)
- [x] Zustand stores + canvas serialization (Session 5.2)
- [x] Canvas + drag and drop + component panel (Session 5.3)
- [x] Props editor + binding input + action bindings (Session 5.4)
- [x] Page settings — data sources + actions + forms + state (Session 5.5)
- [x] App settings — theme + IdP + user groups + assets + members (Session 5.6)
- [x] Auto-save + publish flow + version history + comments (Session 5.7)
- [x] Preview + endpoint tester + action debug panel (Session 5.8)
- [ ] Action config UI
- [ ] Page management
- [ ] Publish flow + version history
- [ ] Preview (split pane + new tab)
- [ ] Theme + IdP + user group config UI
- [ ] Asset picker
- [ ] Commenting
- [ ] Endpoint tester

## Phase 6 — App Renderer
- [x] Next.js setup + auth edge middleware + build webhook (Session 6.1)
- [x] Schema renderer + component resolver + static generation (Session 6.2)
- [x] Data source resolver + binding context + polling (Session 6.3)
- [x] Action execution + auth context + form manager integration (Session 6.4)

## Notes

### 2026-05-07 — Session 6.4: Action execution + auth context + form manager integration complete
- src/lib/auth/authContext.tsx: AuthProvider client component; decodeJwtPayload() does base64url decode of JWT payload (no signature verification — middleware already verified); reads portal_session cookie via document.cookie on mount; provides { sessionToken, user: {id, email, groups}, refresh(), logout() }; refresh() calls /api/auth/refresh + re-reads cookie; logout() calls /api/auth/logout + clears state; accepts initialToken/initialUserId server props for hydration
- src/lib/events/eventBridge.ts: re-exports eventBus singleton from @portal/action-runtime; useEmit(eventName) returns stable emit function; useSubscribe(eventName, handler) calls eventBus.on in useEffect with cleanup
- src/lib/actions/actionContext.tsx: full ActionProvider — creates StateManager (initialised from schema.state, subscribe callback → updateState per key), FormManager (initialised with schema.forms, syncToContext → updateForm with full BindingContext.form shape including values/errors/isDirty/touched/isValid), ModalManager (emits modal:show/modal:hide on eventBus), ConfirmManager (window.confirm), DataResolver adapter (wraps DataSourceResolver.resolveSourceByAlias with bound sources); instantiates ActionExecutor with all deps; execute() calls executor.execute(actionId); renders inline toast overlay (fixed bottom-right, variant-aware styling, auto-dismiss, close button)
- src/hooks/useAction.ts: useAction(binding) — reads ActionContext.execute, returns memoized () => void handler calling execute(binding.actionId, binding.params)
- Provider hierarchy in page.tsx updated: ThemeProvider > AuthProvider > BindingProvider > ActionProvider > SchemaRenderer; AuthProvider receives initialToken + initialUserId from server headers
- TypeScript: tsc --noEmit passes with 0 errors

### 2026-05-07 — Session 6.3: Data source resolver + binding context + polling complete
- src/lib/data/transforms.ts: applyTransform(data, expression) — JSONata evaluate; Sentry captureException on error; rethrows
- src/lib/data/dataSourceResolver.ts: DataSourceResolver class — resolvedData/loadingState/errorState maps; resolvePageDataSources(sources, urlParams) topological-sorts aliases (visits deps recursively, detects cycles) then resolves in order; resolveSourceByAlias(alias, sources, urlParams) re-resolves single source (used by REFRESH_DATASOURCE action + polling); resolveSource builds partial BindingContext, interpolates url/pathParams/queryParams/body via action-runtime interpolate, honours useMock+mockData shortcut, calls executeConnector (POST /connector/execute with Bearer token + REGISTERED/CUSTOM_CONNECTOR/CUSTOM_MANUAL mode payload), applies JSONata transform if defined, handles errorHandling strategy (show-error/show-empty/use-fallback), calls onUpdate callback per update
- src/lib/data/pollingManager.ts: PollingManager — start(sources, resolver, urlParams, getContext) sets setInterval per source with polling.intervalMs; each tick resolves pauseWhen expression via resolveBinding (skips if truthy); stop() clears all intervals
- src/lib/binding/bindingContext.tsx: rewritten with real data fetching; useState for stateSlots (initialised from schema.state defaults), formState, datasource map; useRef for resolver + polling instances; useEffect on [sessionToken, schema.pageId] — creates DataSourceResolver with onUpdate→setDatasource, calls resolvePageDataSources, starts PollingManager, returns cleanup (polling.stop()); contextRef.current tracks latest context for polling closures; exposes resolver ref in context value for useComponentDataSource
- src/hooks/useComponentDataSource.ts: useComponentDataSource(componentDataSource, pageSources, urlParams) — reads alias from componentDataSource; initial data from context.datasource[alias]; internal page/pageSize/sortField/sortDirection state; fetch() builds pagination+sort queryParams, patches sourceDef, calls resolver.resolveSourceByAlias; useEffect on [page,pageSize,sortField,sortDirection] skips initial mount then refetches; returns {data,loading,error,page,pageSize,total,sortField,sortDirection,setPage,setPageSize,setSort,refetch}
- TypeScript: tsc --noEmit passes with 0 errors

### 2026-05-07 — Session 6.2: Schema renderer + component resolver + static generation complete
- src/lib/resolver/componentResolver.tsx: static PRIMITIVES map (34 components from @portal/ui), widgetCache Map for custom widgets; resolveComponent(node) routes by source (primitive/custom_widget/prebuilt_view); preloadCustomWidgets(nodes) flattens tree, dynamically imports custom widget bundles from bundleUrl prop; createPrebuiltViewComponent(node) uses React.lazy + dynamic import of NodeRenderer to avoid circular deps; UnknownComponent fallback renders warning box
- src/lib/resolver/responsiveResolver.ts: useBreakpoint() — SSR-safe (useState default 'desktop', effect attaches MediaQueryList listeners for ≤640px/641-1024px); useResponsiveProps(node) returns node.responsive[breakpoint] overrides or {} for desktop
- src/components/ErrorBoundary.tsx: TrackedErrorBoundary class component; getDerivedStateFromError captures error; componentDidCatch reports to Sentry (window.Sentry, swallows if unavailable); renders ComponentError fallback (type + message + nodeId)
- src/lib/theme/themeInjector.tsx: ThemeProvider server component; builds :root { CSS vars } from tokens map; builds Google Fonts @import for fonts array; injects via dangerouslySetInnerHTML <style> tag; no-op passthrough if no tokens/fonts
- src/lib/binding/bindingContext.tsx: BindingProvider client component (stub for 6.3); initialises state from schema.state defaults; provides full BindingContext shape (datasource:{}, params, user, env, state, form); updateState/updateForm callbacks
- src/lib/actions/actionContext.tsx: ActionProvider client component (stub for 6.4); no-op execute; provides ActionContext shape
- src/hooks/useResolvedProps.ts: useResolvedProps(node) — resolveBinding for all node.bindings, merges static props + resolved bindings + responsive overrides; useResolvedActions(node) — maps ActionBinding[] to trigger handlers that call execute
- src/lib/renderer/schemaRenderer.tsx: NodeRenderer — resolveComponent, useResolvedProps, useResolvedActions, renders children recursively, wrapped in TrackedErrorBoundary; SchemaRenderer renders schema.layout via NodeRenderer
- src/app/[appSlug]/[pageSlug]/page.tsx: generateStaticParams() fetches GET /apps/slug/:slug/deployment/:env, returns {appSlug,pageSlug}[] for all published pages; page component fetches deployment, finds page by slug, reads x-portal-user-id + x-portal-token from headers, mounts ThemeProvider > BindingProvider > ActionProvider > SchemaRenderer
- TypeScript: tsc --noEmit passes with 0 errors

### 2026-05-07 — Session 6.1: Renderer setup + auth edge middleware + build webhook complete
- next.config.ts: transpilePackages for @portal/ui/core/action-runtime
- tailwind.config.ts + postcss.config.js: CSS variable color tokens, content paths include packages/ui
- Added dependencies: ioredis, jose, @openfga/sdk to @portal/renderer
- middleware.ts: PUBLIC_PATHS=[/login, /unauthorized, /api/auth, /api/build]; extracts appSlug from first path segment; reads portal_session cookie; verifies JWT signature via createRemoteJWKSet (jose, edge-safe); POST /auth/validate on Core Backend (includes Redis revocation check); OpenFGA page:appSlug/pageSlug viewer check (fail-closed on errors); injects x-portal-user-id, x-portal-app-id, x-portal-token headers
- src/app/[appSlug]/login/page.tsx: server component; fetches GET /auth/portal/idps?appSlug=&env= from Core Backend; renders login buttons for each IdP; links to /auth/init/:idpId?context=PORTAL with redirectTo
- src/app/[appSlug]/unauthorized/page.tsx: access denied page with link back to home and re-login
- src/app/api/auth/callback/[idpId]/route.ts: GET handler; reads ?token from search params; sets portal_session cookie (HttpOnly, Secure, SameSite=strict, 8h); redirects to redirectTo param
- src/app/api/auth/refresh/route.ts: POST; reads portal_refresh_token cookie; POST /auth/refresh on Core Backend; updates portal_session + portal_refresh_token cookies; 401 on failure with cookie cleanup
- src/app/api/auth/logout/route.ts: POST; POST /auth/logout on Core Backend (best-effort); deletes portal_session + portal_refresh_token cookies; redirects to /{appSlug}/login
- src/app/api/build/webhook/route.ts: POST; HMAC-SHA256 signature verification against BUILD_WEBHOOK_SECRET; parses { deploymentId, appSlug, environment }; returns { received: true } immediately; async revalidatePath trigger via /api/build/revalidate
- src/app/api/build/revalidate/route.ts: GET; x-revalidate-token header check; revalidatePath(/{appSlug}, 'layout')
- src/app/[appSlug]/[pageSlug]/page.tsx: placeholder with generateStaticParams stub (returns [] for now)
- src/lib/apiClient.ts: server-side typed API client for backend calls
- TypeScript: tsc --noEmit passes with 0 errors

### 2026-05-07 — Session 5.8: Preview + endpoint tester + action debug panel complete
- src/lib/redis.ts: ioredis singleton with lazy connect + 1h TTL constant for builder API routes
- POST /api/preview/create: stores PreviewSession (token, appId, pageId, ownerId, schema, mockData, isShared, restrictTo) in Redis with EX 3600; supports existingToken to update in place with ownership check
- GET /api/preview/[token]: validates owner/shared access, refreshes TTL, returns PreviewSession
- POST /api/preview/share: sets isShared=true + optional restrictTo, returns shareUrl
- app/preview/[token]/page.tsx: server component; fetches session server-side; mounts PreviewShell + PreviewRenderer; redirects to /login if unauthenticated
- PreviewShell: PREVIEW badge, breakpoint switcher (desktop/tablet/mobile) fires custom window event, share button → POST /api/preview/share + copy link, open-in-new-tab
- PreviewRenderer: PreviewBindingContext (resolveBinding walks dot-paths through mockData), PreviewActionContext (interceptedActions), minimal PreviewNode tree renderer (stack/card/button/text/input/image + fallback), PreviewActionLogPanel (collapsible, shows intercepted fire events), 2s polling for schema updates
- useLivePreviewSync: debounce 1.5s on canvas nodes+childMap, serializes schema, POSTs to /api/preview/create; returns { previewToken, previewUrl }
- MockDataEditor: per-alias toggle (Use mock/Use real), JSON textarea with parse validation, "Import from last test" button; calls onMockDataChange callback
- EndpointTester: connector selector → endpoint browser OR custom URL + method; path/query param JSON inputs; body editor for POST/PUT/PATCH; POST /endpoints/test; response viewer (status + durationMs + JSON); "Use as mock data for [alias]" button
- ActionDebugPanel: polls GET /action-logs?appId=&pageId=&limit=20 every 3s; log table (timestamp | name | type | status badge | duration); expand row → correlationId + error + metadata JSON
- TypeScript: tsc --noEmit passes with 0 errors

### 2026-05-07 — Session 5.7: Auto-save + publish flow + version history + comments complete
- useAutoSave hook: watches canvasStore.nodes + childMap, debounces 1.5s, serializes canvas → PageSchema via serializeCanvasToSchema, POST /schema/draft; returns { status: idle|saving|saved|error, warning, lastSavedAt, saveNow }; concurrent edit warning surfaced from backend flag
- SaveStatusIndicator: pulsing dot for saving, green dot + relative time for saved, amber warning icon for concurrent edit, red for error
- PromoteDialog: loads version history to find current draft; patch/minor/major bump selector with preview of new version string; staging/production environment selector; required changelog textarea; POST to /schema/:versionId/promote/staging|production; build status polling loop (PENDING → BUILDING → SUCCESS/FAILED)
- VersionHistoryPanel: GET /schema/:pageId/history; table with v{semver} + status badge (DRAFT/STAGED/PUBLISHED/ARCHIVED/ROLLED_BACK); "View diff" → GET /schema/:pageId/diff?from=&to= shows JSON Patch; "Rollback" (ARCHIVED only) → confirmation dialog → POST /schema/:pageId/rollback
- CommentBadge: count bubble, click-stops-propagation, hidden when 0
- CommentPanel: node-scoped comment list; new comment textarea (⌘↵ submit); resolve button per comment; reply thread with inline reply input; full CRUD via backend endpoints
- Backend comment endpoints added to apps router + service: POST/GET /apps/:id/pages/:pageId/comments, PATCH (resolve), POST replies
- TypeScript: builder tsc --noEmit passes with 0 errors; no new backend errors introduced

### 2026-05-06 — Session 5.6: App settings — theme + IdP + user groups + assets + members complete
- ThemePanel: CSS var color pickers (--brand-primary/secondary/surface/text), Google font selector, border-radius input, live preview swatch, PATCH /api/apps/:id/theme
- IdPPanel: STAGING/PRODUCTION environment tabs, IdP list with enable/disable toggle (PATCH), AddIdPModal — display name, protocol (OIDC/SAML/Google/Okta/Auth0), OIDC fields (issuer URL, client ID/secret), POST /auth/portal-idps/:appId
- UserGroupPanel: group list with Edit/Delete, GroupModal — name/description/members (add by email, remove); CRUD to /apps/:appId/user-groups endpoints
- AssetPanel: search + MIME filter, drag-drop upload zone, asset grid (image preview or file icon), click-to-copy URL with "Copied!" overlay, delete button on hover; GET/POST/DELETE /assets
- MembersPanel: lazy-loaded member list, invite by email + role select, change role dropdown, Remove (blocked when last OWNER); GET/POST/PATCH/DELETE /apps/:appId/members
- AppSettingsModal: sidebar tab navigation (General | Theme | Authentication | User Groups | Assets | Members), GeneralPanel (name/slug PATCH), backdrop-click to close
- TypeScript: tsc --noEmit passes with 0 errors

### 2026-05-06 — Session 5.5: Builder page settings — data sources + actions + forms + state complete
- DataSourcePanel: list + add/edit/delete; DataSourceModal — mode (REGISTERED/CUSTOM_CONNECTOR/CUSTOM_MANUAL), alias, endpointId/URL, transform (JSONata string), polling interval, mock data JSON editor with useMock toggle, POST /endpoints/test + import-as-mock button
- ActionPanel: list + add/edit/delete; ActionModal — name, type selector (19 types), type-specific config forms (API_CALL/NAVIGATE/OPEN_URL/SET_STATE/SHOW_TOAST/SHOW_CONFIRM/TRIGGER_WEBHOOK/RUN_SEQUENCE/RUN_PARALLEL/CONDITIONAL/DELAY/SUBMIT_FORM/RESET_FORM/REFRESH_DATASOURCE); writes to appStore
- FormPanel: list + add/edit/delete; FormModal — form ID, field list with add/remove, per-field name/label/type/required, submit action selector; resetOnSubmit toggle; writes to appStore
- StatePanel: inline add form — name/type/defaultValue; list with delete; writes to appStore
- PageMetaPanel: active page name/slug/order editing; user group checkboxes (from appStore.userGroups); writes to pageStore
- SettingsSidebar: tabbed container (Data | Actions | Forms | State | Page); open/close prop; mounts all panels
- TypeScript: tsc --noEmit passes with 0 errors

### 2026-05-06 — Session 5.4: Builder props editor + binding input + action bindings complete
- src/hooks/useBindingSuggestions.ts: builds autocomplete paths from dataSources (alias + bindingPaths), stateSlots, forms (values/errors/isValid/isSubmitting), user/env context
- src/components/props/BindingInput.tsx: textarea that opens suggestion dropdown on {{ trigger; filters by typed query; selects by replacing last {{ prefix with {{path}}; click-outside closes
- src/components/props/StaticInput.tsx: routes by Zod type — ZodString→text, ZodNumber→number, ZodBoolean→checkbox, ZodEnum→select, ZodArray→ArrayEditor (add/remove items), ZodObject→JsonEditor (textarea with JSON parse validation); unwraps ZodOptional/ZodNullable/ZodDefault
- src/components/props/PropField.tsx: label + Static/{{}} mode toggle switch; static → StaticInput, binding → BindingInput; writes to canvasStore updateProps / updateBinding
- src/components/props/ActionsEditor.tsx: lists COMMON_TRIGGERS (onClick/onChange/onSubmit/onBlur/onFocus); each trigger shows bound action name or "+ Bind action"; click opens inline action selector dropdown; bindAction writes to canvasStore updateActions
- src/components/props/StyleEditor.tsx: collapsible section; 8 style props (padding/margin/width/height/background/border/borderRadius/display); responsive-aware — writes to node.responsive.tablet|mobile when breakpoint ≠ desktop; shows "responsive" badge when overrides exist
- src/components/props/PropsEditor.tsx: right panel; reads selectedNodeId + node from canvasStore; finds registry entry → propsSchema.shape → renders PropField per key; ActionsEditor + StyleEditor sections; empty state when no node selected
- TypeScript: tsc --noEmit passes with 0 errors

### 2026-05-06 — Session 5.3: Builder canvas + drag-and-drop + component panel complete
- src/lib/primitives.ts: registerPrimitives(map) + resolvePrimitive(type) — late-binding component registry for SSR safety
- src/components/canvas/ComponentGhost.tsx: semi-transparent drag overlay label shown in DragOverlay during drag
- src/components/canvas/DropZone.tsx: useDroppable empty-state drop target, border highlights on isOver
- src/components/canvas/CanvasToolbar.tsx: breakpoint switcher (Desktop/Tablet/Mobile) + zoom controls (⌘+/-/0); reads useBreakpointStore
- src/components/canvas/CanvasNodeWrapper.tsx: useDraggable (source=canvas) + useDroppable per node; blue selection ring, gray hover ring, opacity on drag; stopPropagation on click/mouseEnter
- src/components/canvas/NodeRenderer.tsx: recursive renderer; useResolvedProps merges base props + breakpoint responsive overrides; resolvePrimitive lookup; fallback unknown-component box; DropZone for empty container nodes
- src/components/canvas/BuilderCanvas.tsx: DndContext + PointerSensor (4px activation); dragStart → sets ghost label; dragEnd → panel source: addNode, canvas source: moveNode; breakpoint-width canvas frame; zoom scaling; DragOverlay
- src/components/panel/ComponentPanel.tsx: search input + category filter tabs (All + 7 categories); useDraggable tiles (source=panel, type=entry.name); filters by status=ACTIVE; loading spinner + empty state
- src/hooks/useKeyboardShortcuts.ts: all shortcuts — ⌘Z/⌘⇧Z (undo/redo), Delete/Backspace (delete node), ⌘C (copy), ⌘V (paste), ⌘D (duplicate), ⌘↑/↓ (reorder), ⌘1/2/3 (breakpoints), ⌘S (save), ⌘=/- /0 (zoom), Escape (deselect); skips shortcuts when focus is in input/textarea
- TypeScript: tsc --noEmit passes with 0 errors

### 2026-05-06 — Session 5.2: Builder Zustand stores + canvas serialization complete
- src/types/canvas.ts: CanvasNode, DragState, CanvasState, Breakpoint, AppMeta, PageMeta, AppIdentityProvider, AppUserGroup, ClipboardEntry — builder-local types
- src/stores/canvasStore.ts: useCanvasStore — zundo temporal (limit 50, partialize nodes+childMap+parentMap) + immer; addNode/moveNode/updateProps/updateBinding/updateStyle/updateResponsive/updateActions/deleteNode (recursive descendants); selectNode/setHoveredNode/setDragState; insertSubtree (for paste); loadCanvas; undo/redo via temporal
- src/stores/pageStore.ts: usePageStore — pages[], activePageId; setActivePage/addPage/updatePage/deletePage/reorderPages/setPages
- src/stores/appStore.ts: useAppStore — app/theme/dataSources/actions/forms/stateSlots/idProviders/userGroups; all CRUD actions
- src/stores/registryStore.ts: useRegistryStore — entries[]/isLoading; fetchEntries(appId) → GET /registry/entries
- src/stores/breakpointStore.ts: useBreakpointStore — active: desktop|tablet|mobile; setActive
- src/stores/clipboardStore.ts: useClipboardStore — sessionStorage persist; copy(nodeId, canvas) extracts subtree; paste() remaps all IDs to fresh UUIDs; returns remapped subtree for canvasStore.insertSubtree
- src/lib/schema/createNode.ts: createNode(type, source, registryEntry) — creates CanvasNode with defaultProps from registry version
- src/lib/schema/serialize.ts: serializeCanvasToSchema(canvas, page, app, options) — walks childMap from rootId, builds ComponentNode tree, returns PageSchema
- src/lib/schema/deserialize.ts: deserializeSchemaToCanvas(schema) — flattens ComponentNode tree into normalized nodes/childMap/parentMap maps
- TypeScript: tsc --noEmit passes with 0 errors

### 2026-05-06 — Session 5.1: Builder Next.js setup + FDE auth complete
- next.config.ts: transpilePackages for @portal/ui/core/action-runtime
- tailwind.config.ts: CSS variable color tokens, content paths include packages/ui
- middleware.ts: PUBLIC_PATHS=[/login,/auth/callback,/api/auth]; reads session cookie, POST /auth/validate, injects x-fde-user-id + x-fde-role; redirects to /login on 401/failure
- src/lib/apiClient.ts: server-side apiFetch (reads HttpOnly cookie via next/headers, server-side URL), clientFetch for browser; both attach Authorization header; 401 → redirect /login
- src/app/login/page.tsx: server component, fetches GET /auth/builder/idps, renders IdPLoginButton for each; links to /auth/init/:idpId?context=BUILDER
- src/app/auth/callback/[idpId]/page.tsx: client component, reads ?token from params, POSTs to /api/auth/session, redirects to /
- src/app/api/auth/session/route.ts: POST — sets session cookie (HttpOnly, Secure, SameSite=strict, 8h)
- src/app/api/auth/logout/route.ts: POST — calls /auth/logout on backend, clears cookie, redirects to /login
- src/hooks/useSession.ts: client hook, parses JWT from session cookie, returns FDESession { userId, email, role, exp }
- src/app/page.tsx: redirect to /apps
- src/app/apps/page.tsx: server component, fetches GET /apps, displays app cards grid; new app link
- TypeScript: tsc --noEmit passes with 0 errors

### 2026-05-06 — Session 4.4: /packages/action-runtime complete
- binding/bindingResolver.ts: resolveBinding (strips {{}}, splits on ., handles rows[] array notation), interpolate (deepMap — string|array|object), deepResolve alias; uses BindingContext from @portal/core
- state/stateManager.ts: StateManager class — constructor(initialState, dispatch?), get/set/reset/toggle keys, init(slots[]), subscribe/notify listener pattern
- events/eventBus.ts: ComponentEventBus — on/off/emit/clear, returns unsubscribe from on(); singleton `export const eventBus = new ComponentEventBus()`
- forms/formValidation.ts: runValidation/runValidations — all ValidationType rules: required, minLength, maxLength, min, max, pattern, email, url, custom (JSONata expression from rule.value, dynamic import)
- forms/formManager.ts: FormManager — initialize(formDefs, onSync?), setValue(formId, field, value) + async validate, validateField, validateAll (marks all touched), submit (validateAll → return false if invalid), reset (to defaults from FormDef), getState(formId), syncToContext callback, subscribe listener pattern
- executor/actionTypes.ts: ExecuteContext, ExecuteResult (exactOptionalPropertyTypes-safe), ModalManager, ToastManager, ConfirmManager, DataResolver, RouterAdapter interfaces
- executor/actionExecutor.ts: ActionExecutor — all 19 action types: API_CALL (POST /connector/execute with x-correlation-id), REFRESH_DATASOURCE (dataResolver.resolveSourceByAlias), NAVIGATE (router.push), OPEN_URL (window.open), SET_STATE/RESET_STATE/TOGGLE_STATE (stateManager), SHOW_MODAL/CLOSE_MODAL (modalManager), SHOW_TOAST (toastManager), SHOW_CONFIRM (confirmManager, returns Promise<boolean>), SUBMIT_FORM/RESET_FORM/SET_FORM_VALUE (formManager), TRIGGER_WEBHOOK (fire-and-forget, 10s AbortController), RUN_SEQUENCE (loop, stopOnError), RUN_PARALLEL (Promise.all/race), CONDITIONAL (branch onTrue/onFalse), DELAY (setTimeout Promise); non-blocking POST to /action-logs after every execution; chained outcome actions (onSuccess/onError)
- vite.config.ts: Vite library build, ESM+CJS, zod/@portal/core externalized
- Build: pnpm --filter @portal/action-runtime build passes — 13.6kB ESM + jsonata chunk

### 2026-05-06 — Session 4.3: /packages/ui Part 2 complete
- Display (4): Badge (variant: default/success/warning/error/info/outline, size sm/md), Avatar (src/alt/fallback initials, imgError state), Tag (label/color/removable + onRemove), StatCard (value/previousValue/trend/format number|currency|percent, loading skeleton)
- Data (2): DataTable (TanStack Table, getCoreRowModel + getSortedRowModel + getPaginationRowModel, sortable columns, searchable, striped, loading/error states, pagination controls, onRowClick), Chart (Recharts — line/bar/area/pie, xKey/yKeys/colors, title/height/showLegend/showGrid)
- Input (10): TextInput (prefix/suffix/helperText), NumberInput (min/max/step), Select (Radix Select), MultiSelect (custom dropdown + tag display + searchable), DatePicker (react-day-picker, single/range modes, click-outside close), Checkbox (Radix Checkbox, indeterminate state), Toggle (Radix Switch, sm/md/lg sizes, label left/right), RadioGroup (Radix RadioGroup, horizontal/vertical orientation), Textarea (rows/resize/character count/showCount), FileUpload (drag-drop zone, accept/maxSize validation, progress bar)
- src/index.ts: updated with all 16 new components (4 display + 2 data + 10 input)
- Build: pnpm --filter @portal/ui build passes — 1.6MB bundle (recharts + react-day-picker bundled)

### 2026-05-06 — Session 4.2: /packages/ui Part 1 complete
- vite.config.ts: @vitejs/plugin-react@4 + vite-plugin-dts, ESM + CJS library output; react/react-dom/zod/@portal/core externalized
- src/lib/utils.ts: cn() utility (clsx + tailwind-merge)
- src/hooks/useThemeTokens.ts: injects CSS variables into :root on token change
- src/hooks/useActionBinding.ts: wraps ActionBinding + ActionExecutor into a memoized callback
- Layout (7): Stack (flex, direction/gap/align/justify/wrap), Grid (CSS grid, columns/gap/align), Divider (horizontal/vertical), Card (padding/shadow/border/rounded, header+footer slots), Tabs (Radix, items with content slot), Accordion (Radix, single/multiple), Modal (Radix Dialog, size/closeOnOverlay)
- Action (4): Button (variant/size/loading, updated to spec variants), IconButton (aria-label, same variants as Button), Link (href/target/variant), DropdownMenu (Radix, items with onClick/icon/destructive)
- Feedback (6): Alert (info/success/warning/error, dismissible), Toast (Radix Toast + ToastProvider), Spinner (size variants), Skeleton (width/height/rounded), EmptyState (icon/title/description/action), ErrorBoundary (React class component, retry button, onError callback)
- Typography (3): Heading (h1-h6, size/weight/align), Text (p/span/div/label, size/weight/muted/truncate), RichText (TipTap StarterKit, editable flag)
- All primitives export {Name}PropsSchema (Zod) + {name}Manifest — no barrel naming conflicts
- Build: pnpm --filter @portal/ui build passes — 717kB ESM bundle

### 2026-05-06 — Session 4.1: /packages/core complete
- types/actions.ts: Complete ActionType enum (19 types incl. REFRESH_DATASOURCE, OPEN_URL, RESET_STATE, TOGGLE_STATE, SHOW_CONFIRM, SET_FORM_VALUE, RUN_PARALLEL, DELAY); all per-type config schemas (ApiCallConfig, NavigateConfig, OpenUrlConfig, SetStateConfig, ShowModalConfig, ShowToastConfig, ShowConfirmConfig, RunSequenceConfig, RunParallelConfig, ConditionalConfig, DelayConfig, SetFormValueConfig, TriggerWebhookConfig, etc.); ActionDef, ActionBinding, ActionTrigger, ValidationType, FieldValidationDef, FormFieldDef, FormDef
- types/datasource.ts: PollingDef, ErrorHandlingDef, TransformDef, QueryDef; complete DataSourceDef (REGISTERED/CUSTOM_CONNECTOR/CUSTOM_MANUAL modes); ConnectorConfig; ComponentDataSource (with pagination/sorting/filtering config); BindingContext (datasource/params/user/env/state/form)
- types/schema.ts: ComponentNode (recursive via z.lazy, exactOptionalPropertyTypes-safe interface); PageSchema (dataSources/actions/forms now fully typed); StyleOverride, ResponsiveOverride, StateSlotDef, ThemeOverride, PageParamDef
- types/registry.ts: Added PropsSchemaMap type
- types/auth.ts, types/api.ts: Completed with Paginated<T> generic TypeScript type
- zod/schema.ts + zod/auth.ts: Z-suffix re-exports for action-runtime and renderer consumption
- vite.config.ts: Vite + vite-plugin-dts, ESM + CJS output
- Build: pnpm --filter @portal/core build passes — 13kB ESM + CJS + declaration files

### 2026-05-06 — Session 3.4: Action logs module complete
- modules/action-logs/types.ts: ActionLogEntrySchema (correlationId optional, all required fields), IngestRequestSchema (max 100 events), QueryFiltersSchema (appId required, pageId/userId/status optional, limit default 50)
- modules/action-logs/service.ts: ingest() — non-blocking createMany (fire and forget, swallows DB errors via .catch → Sentry warning), query() — findMany with appId/pageId/userId/status filters, ordered by executedAt desc, limited by params.limit
- modules/action-logs/router.ts: POST /action-logs — validates Bearer token via authService.validateToken (portal or service token), rejects batch > 100 → 400, fires non-blocking ingest, returns 202 immediately; GET /action-logs — requires FDE auth via requireAuth preHandler, validates query with QueryFiltersSchema
- 9 tests (104 total): POST returns 202 before DB write, batch > 100 → 400, DB failure doesn't affect 202 response, 401 with no token; GET filters by appId/pageId/status, includes correlationId in response, respects limit

### 2026-05-06 — Session 3.3: Assets module complete
- modules/assets/storage.ts: StorageProvider interface + LocalStorageProvider (writes to UPLOAD_DIR, serves via CORE_BACKEND_URL/assets/{key}); createStorageProvider() factory — swap via STORAGE_PROVIDER env var
- modules/assets/validator.ts: validateFile — allowed MIME types (png/jpeg/svg/webp/gif/woff2/woff/pdf), 10MB size limit → 413, extension/MIME mismatch, SVG <script tag rejection → 400
- modules/assets/service.ts: handleUpload (SHA-256 content-addressed key apps/{appId}/{hash}{ext}, deduplication via key uniqueness check, sharp image dimension extraction for image/* except SVG), checkAssetReferenced (raw Postgres jsonb query on PageVersion schema column), listAssets (filter by mimeType/search), deleteAsset (reference check → 409)
- modules/assets/router.ts: POST /assets/upload (multipart, x-app-id header), GET /assets?appId=&mimeType=&search=, DELETE /assets/:id, GET /assets/* (serve file with Cache-Control: public, max-age=31536000, immutable)
- Dependencies added: sharp, mime-types, @types/mime-types
- 12 tests (95 total): validateFile accepts PNG, rejects 10MB+, rejects bad MIME, rejects SVG+script, accepts clean SVG; handleUpload deduplication, image dimensions extracted, SVG+script → 400, 10MB+ → 413; deleteAsset not referenced, referenced → 409, not found → 404

### 2026-05-06 — Session 3.2: Connector module complete
- connector/rateLimiter.ts: checkRateLimit — sliding window via Redis pipeline (zremrangebyscore + zcard + zadd), three windows (per-min/hour/day), config cached 5 min in Redis
- connector/concurrencyLimiter.ts: acquireConcurrencySlot (Lua atomic check+INCR, 60s expiry for leaked lock protection), releaseConcurrencySlot (DECR in finally)
- connector/cache.ts: getCached/setCached/invalidateEndpointCache — GET+REGISTERED only, reads TTL from EndpointCacheConfig, pattern-based invalidation
- connector/auditLogger.ts: non-blocking ConnectorRequestLog insert, Sentry warning for >5s, Sentry error for failed requests
- connector/executor.ts: executeRequest — REGISTERED (validates required path params → 400, resolves connector auth, builds URL), CUSTOM_CONNECTOR (SSRF validation, resolves connector auth), CUSTOM_MANUAL (SSRF validation); 30s timeout → 504, generic fetch error → 502, response size → 413
- connector/service.ts: connectorService.execute — rate limit check → 429, concurrency acquire → 429, cache hit → skip execution, execute, cache response, invalidate endpoints, audit log; release concurrency in finally
- connector/router.ts: POST /connector/execute — validates Bearer service token via authService.validateToken
- 8 tests (83 total): REGISTERED mode auth resolved, deactivated endpoint → 410, CUSTOM_CONNECTOR auth from connector, rate limit → 429, concurrency limit → 429, cache hit skips fetch, timeout → 504, audit log written per request

### 2026-05-06 — Session 3.1: Endpoint registry module complete
- modules/endpoint-registry/lib/bindingPaths.ts: computeBindingPaths(schema, prefix) — recursively walks JSON Schema, returns all leaf paths including array item paths with [] notation (e.g. data.rows[].id)
- modules/endpoint-registry/lib/ssrf.ts: validateUrl(url) — blocks localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.169.254 (AWS metadata), 0.0.0.0, metadata.google.internal → throws 403; non-http/https → 403; invalid URL → 400
- modules/endpoint-registry/types.ts: RegisterConnectorSchema, RegisterEndpointSchema, UpdateEndpointSchema, TestEndpointSchema with ParamDefSchema
- modules/endpoint-registry/service.ts: listConnectors, registerConnector (SSRF-validates base URLs, encrypts authConfig via secretsProvider), listConnectorEndpoints, getEndpoint, registerEndpoint (auto-computes bindingPaths from responseSchema), updateEndpoint (recomputes paths on responseSchema change), deactivateEndpoint (soft delete isActive=false), testEndpoint (REGISTERED/CUSTOM_CONNECTOR/CUSTOM_MANUAL modes, 30s timeout → 504, required path param validation → 400, SSRF validation, async custom endpoint usage logging)
- modules/endpoint-registry/router.ts: GET/POST /endpoints/connectors, GET /endpoints/connectors/:id/endpoints, POST /endpoints/test, POST /endpoints/, GET/PATCH/DELETE /endpoints/:id
- 18 tests (75 total): computeBindingPaths flat/nested/array cases, validateUrl SSRF cases (all private ranges), registerConnector auth encrypted, registerConnector SSRF rejected, registerEndpoint binding paths computed, connector not found → 404, testEndpoint missing path param → 400, SSRF blocked, timeout → 504, custom endpoint usage logged

### 2026-05-06 — Session 2.5: Registry module + primitive seeding complete
- modules/registry/types.ts: Zod schemas — RegisterCustomWidgetSchema, SavePrebuiltViewSchema, DeprecateEntrySchema, PropsSchemaQuerySchema, GetEntriesQuerySchema
- modules/registry/service.ts: listForApp (COMMON + TENANT_LOCAL for app), getEntry (by name + optional version), getPropsSchema (batch fetch for schema validation), registerCustomWidget (COMMON name collision → 409, TENANT_LOCAL if appId provided), savePrebuiltView (upsert with version increment), deprecate (404 if missing, 409 if already deprecated)
- modules/registry/router.ts: GET /registry/entries?appId=, GET /registry/entries/:name, GET /registry/props-schema?components=, POST /registry/custom-widget, POST /registry/prebuilt-view, POST /registry/entries/:id/deprecate
- modules/registry/seed.ts: seeds 34 primitive components across 6 categories (Layout: Stack/Grid/Divider/Card/Tabs/Accordion/Modal; Data: DataTable/Chart/StatCard/Badge/Avatar/Tag; Input: TextInput/NumberInput/Select/MultiSelect/DatePicker/Checkbox/Toggle/RadioGroup/Textarea/FileUpload; Action: Button/IconButton/Link/DropdownMenu; Feedback: Alert/Toast/Spinner/Skeleton/EmptyState/ErrorBoundary; Typography: Heading/Text/RichText) — each with full propsSchema and defaultProps
- 14 tests (57 total): listForApp COMMON+TENANT_LOCAL, no other-tenant entries, currentVersionDetails populated, DEPRECATED included, getPropsSchema correct schemas, empty list, unknown component, registerCustomWidget TENANT_LOCAL, duplicate COMMON → 409, savePrebuiltView v1.0.0, deprecate happy path, 404, 409 already deprecated, entry persists in DB after deprecation

### 2026-05-06 — Session 2.4: Schema module complete
- modules/schema/types.ts: ComponentNodeZ (recursive via z.lazy), PageSchemaZ (full page schema), SaveDraftRequestSchema, PromoteRequestSchema, RollbackRequestSchema, DiffQuerySchema
- modules/schema/service.ts: saveDraft (5MB size guard → 413, registry validation against db.registryEntry → 400, concurrent edit detection 30s window → warning flag, JSON Patch diff via fast-json-patch, version carries over from latest), promoteToStaging + promoteToProduction (semver.inc for bump, STAGING requires DRAFT → 409, PRODUCTION requires STAGED → 409, creates Deployment PENDING + DeploymentPage, fires HMAC-SHA256 webhook async, updates to BUILDING), rollback (PUBLISHED → ROLLED_BACK, target → PUBLISHED, PRODUCTION deployment + webhook), getHistory, getDiff (uses stored diffFromPrev if available, else computes), triggerBuild (HMAC-SHA256 signed, x-build-signature header)
- modules/schema/router.ts: POST /schema/draft, POST /schema/:versionId/promote/staging, POST /schema/:versionId/promote/production, POST /schema/:pageId/rollback, GET /schema/:pageId/history, GET /schema/:pageId/diff?from=&to=
- 13 tests (43 total): saveDraft happy path, registry validation failure → 400, concurrent edit warning, no warning on own drafts, semver minor bump, semver patch bump, staging rejects non-DRAFT → 409, production rejects non-STAGED → 409, rollback state transitions, rollback fires webhook, HMAC signature correctness, webhook payload shape

### 2026-05-06 — Session 2.1: Auth module Part 1 complete
- tokenSigner.ts: RS256 sign/verify with jose, JWKS export, `verifyTokenExpired` for refresh rotation
- sessionManager.ts: issueSessionTokens (argon2 hashed refresh token), rotateRefreshToken (reuse detection), revokeTokenFamily, revokeAllSessions, isRevoked (Redis fast path + Postgres fallback)
- router.ts: POST /auth/refresh, POST /auth/logout, POST /auth/validate, GET /auth/jwks
- service.ts: public interface wrapping all session operations
- /.well-known/jwks.json in index.ts updated to use real tokenSigner.getJWKS()
- 11 tests, all passing: token round-trip, PORTAL token, tamper rejection, refresh rotation, reuse detection, revocation, all-session logout, expiry handling
- vitest.config.ts created (was missing)

### 2026-05-06 — Session 2.3: Apps module complete
- modules/apps/types.ts: Zod schemas for CreateApp, UpdateApp, CreatePage, UpdatePage, AddMember, UpdateMemberRole, and all param schemas
- modules/apps/service.ts: createApp (slug uniqueness + auto-OWNER), listApps (admin sees all / FDE sees member apps), getApp, updateApp, createPage, listPages, updatePage, deletePage (deployment reference check → 409), listMembers, addMember, updateMemberRole, removeMember (last OWNER protection → 409), getDeployment (Renderer build-time fetch with full page version schemas), getMemberRole
- middleware/auth.ts: extractFDESession (calls authService.validateToken), requireAuth preHandler, requireAppRole(minRole) preHandler factory (ADMIN bypasses, role rank checked)
- modules/apps/router.ts: all 13 endpoints — POST/GET/PATCH /apps, POST/GET/PATCH/DELETE /apps/:id/pages, GET /apps/slug/:slug/deployment/:env, GET/POST/PATCH/DELETE /apps/:id/members; all with requireAuth + requireAppRole guards
- 10 tests (30 total): createApp happy path, duplicate slug → 409, delete page no refs, delete page STAGED ref → 409, delete page PUBLISHED ref → 409, remove last OWNER → 409, remove OWNER when multiple OK, remove EDITOR OK, getMemberRole null for non-member, getMemberRole correct role

### 2026-05-06 — Session 2.2: Auth module Part 2 complete
- lib/oidcClient.ts: buildOIDCClient (openid-client v5 Issuer.discover), initiateOIDCFlow (PKCE, OAuthState record), handleOIDCCallback (state validation, code exchange, userinfo)
- lib/samlClient.ts: initiateSAMLFlow (samlify SP createLoginRequest, SAMLState record), handleSAMLCallback (parseLoginResponse, signature validation)
- lib/openFGASync.ts: syncUserGroups — writes AppUserGroupMember tuples to OpenFGA; failure is non-throwing (Sentry + log)
- router.ts: GET /auth/builder/idps, GET /auth/portal/idps, GET /auth/init/:idpId, GET /auth/callback/oidc/:idpId, POST /auth/callback/saml/:idpId, POST /auth/service-token; also CRUD routes for builder + portal IdPs
- service.ts: listBuilderIdPs, createBuilderIdP, updateBuilderIdP, listAppIdPs, listEnabledAppIdPs, createAppIdP (encrypts config via secretsProvider), updateAppIdP, toggleAppIdP, getAppIdPConfig/getBuilderIdPConfig
- 9 new tests (20 total passing): OAuthState creation + TTL, SAMLState creation, enabled IdP filtering, disabled IdP exclusion, OpenFGA sync success + failure non-throwing + empty-membership skip

### 2026-05-06 — Phase 1 complete
- Local Postgres conflict on port 5432 (macOS has Postgres running) → Docker postgres mapped to 5433 host port; internal container port remains 5432; DATABASE_URL uses 5433 for local dev.
- Two models not in spec but implied by relations: `DataSource` (from `App.dataSources`) and `AnalyticsEvent` (from `Page.analytics`) — added minimal definitions.
- `FDEUser` model added (implied by auth module POC scope: "FDE user model — ADMIN | FDE roles").
- pnpm 9+ available at `/opt/homebrew/bin/pnpm`; Node 20 at `/opt/homebrew/opt/node@20/bin/node`.
