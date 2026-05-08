/**
 * Starter page templates for the "New App" flow.
 *
 * Each starter is a self-contained `(name, slug, order, layout)` triple, plus
 * the minimal schema scaffolding that the `/schema/draft` endpoint expects.
 * Schemas here intentionally use only built-in primitives — no widgets, no
 * data sources — so an FDE can drop in anywhere without provisioning DRDV /
 * connectors first.
 *
 * Ids inside `layout` are stable (`home-root`, etc.) because the schema
 * service stores them verbatim; they do not collide across pages because the
 * primary key is `pageId`. The renderer / canvas-deserializer don't need
 * unique-across-app ids — only unique within the page tree.
 */

export type StarterPageId = 'home' | 'shipments' | 'settings'

export interface StarterPage {
  id: StarterPageId
  name: string
  slug: string
  order: number
  description: string
  /** Root node — directly serialisable as the page schema's `layout`. */
  buildLayout: () => unknown
}

interface NodeSpec {
  id: string
  type: string
  props?: Record<string, unknown>
  children?: NodeSpec[]
}

/**
 * Convert a nested NodeSpec into the schema-shaped layout object the backend
 * stores. Mirrors the canonical CanvasNode shape (id/type/source/props/
 * bindings/actions/style/responsive/children).
 */
function buildNode(spec: NodeSpec): Record<string, unknown> {
  return {
    id: spec.id,
    type: spec.type,
    source: 'primitive',
    props: spec.props ?? {},
    bindings: {},
    actions: [],
    style: {},
    responsive: {},
    children: (spec.children ?? []).map(buildNode),
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

function homeLayout(): unknown {
  return buildNode({
    id: 'home-root',
    type: 'Stack',
    props: { direction: 'vertical', gap: 6, align: 'stretch', justify: 'start' },
    children: [
      { id: 'home-h1', type: 'Heading',
        props: { text: 'Welcome', level: 'h1', size: '2xl', weight: 'bold' } },
      { id: 'home-text', type: 'Text',
        props: {
          content: 'This is your portal home page. Customise it from the builder.',
          as: 'p', size: 'md', muted: true,
        } },
      { id: 'home-card', type: 'Card',
        props: {
          title: 'Getting started',
          description: 'Drag components from the left panel to build your home page.',
          padding: 'md', shadow: 'sm',
        } },
    ],
  })
}

function shipmentsLayout(): unknown {
  return buildNode({
    id: 'ship-root',
    type: 'Stack',
    props: { direction: 'vertical', gap: 4, align: 'stretch', justify: 'start' },
    children: [
      { id: 'ship-h1', type: 'Heading',
        props: { text: 'Shipments', level: 'h1', size: '2xl', weight: 'bold' } },
      { id: 'ship-text', type: 'Text',
        props: {
          content: 'Wire this table to your shipments API via the Data tab.',
          as: 'p', size: 'sm', muted: true,
        } },
      { id: 'ship-table', type: 'DataTable',
        props: {
          title: '',
          columns: [
            { key: 'shipmentId', label: 'Shipment ID', sortable: true },
            { key: 'origin', label: 'Origin', sortable: true },
            { key: 'destination', label: 'Destination', sortable: true },
            { key: 'status', label: 'Status', sortable: false },
            { key: 'eta', label: 'ETA', sortable: true },
          ],
          pageSize: 20,
          striped: true,
          searchable: true,
          exportable: false,
        } },
    ],
  })
}

function settingsLayout(): unknown {
  return buildNode({
    id: 'settings-root',
    type: 'Stack',
    props: { direction: 'vertical', gap: 6, align: 'stretch', justify: 'start' },
    children: [
      { id: 'settings-h1', type: 'Heading',
        props: { text: 'Settings', level: 'h1', size: '2xl', weight: 'bold' } },
      { id: 'settings-h2', type: 'Heading',
        props: { text: 'Profile', level: 'h2', size: 'lg', weight: 'semibold' } },
      { id: 'settings-name', type: 'TextInput',
        props: { label: 'Full name', placeholder: 'Jane Doe', disabled: false, required: false } },
      { id: 'settings-email', type: 'TextInput',
        props: { label: 'Email', placeholder: 'jane@company.com', disabled: false, required: true } },
      { id: 'settings-h3', type: 'Heading',
        props: { text: 'Notifications', level: 'h2', size: 'lg', weight: 'semibold' } },
      { id: 'settings-emailOptIn', type: 'Toggle',
        props: { label: 'Email me about portal updates', checked: true, disabled: false, size: 'md' } },
      { id: 'settings-save', type: 'Button',
        props: { label: 'Save changes', variant: 'default', size: 'md', type: 'button' } },
    ],
  })
}

// ── Catalog (rendered as toggles in the New App form) ────────────────────────

export const STARTER_PAGES: StarterPage[] = [
  {
    id: 'home',
    name: 'Home',
    slug: 'home',
    order: 0,
    description: 'Welcome page with a heading and getting-started card',
    buildLayout: homeLayout,
  },
  {
    id: 'shipments',
    name: 'Shipments',
    slug: 'shipments',
    order: 1,
    description: 'Pre-configured shipments table — wire it to your API',
    buildLayout: shipmentsLayout,
  },
  {
    id: 'settings',
    name: 'Settings',
    slug: 'settings',
    order: 2,
    description: 'Profile + notification preferences form',
    buildLayout: settingsLayout,
  },
]

/**
 * Build the request body for `POST /schema/draft` for a given starter page.
 * Caller supplies the freshly-created appId/pageId and userId (savedBy).
 */
export function buildStarterDraft(
  starter: StarterPage,
  appId: string,
  pageId: string,
  userId: string,
): { pageId: string; schema: Record<string, unknown>; savedBy: string } {
  const schema = {
    pageId,
    appId,
    version: '0.1.0',
    meta: {
      title: starter.name,
      slug: starter.slug,
      order: starter.order,
      auth: { required: false, groups: [] },
    },
    layout: starter.buildLayout(),
    dataSources: [],
    actions: [],
    forms: [],
    state: [],
    theme: { tokens: {}, fonts: [] },
    params: [],
  }
  return { pageId, schema, savedBy: userId }
}
