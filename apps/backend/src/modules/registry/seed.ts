import { PrismaClient, Prisma } from '@prisma/client'
import { widgetSeedEntries } from '@portal/widgets/seed'

const prisma = new PrismaClient()

interface PrimitiveDefinition {
  name: string
  displayName: string
  description: string
  category: string
  // Optional so widget entries (which only need `category`) can share this
  // shape without a parallel interface.
  group?: string
  icon: string
  tags: string[]
  propsSchema: Record<string, unknown>
  defaultProps: Record<string, unknown>
  releasedAt?: Date
  // Prebuilt views ship a canvas subtree that gets cloned (with fresh node IDs)
  // onto the builder canvas at import time. Set only on `views` entries.
  viewSchema?: ViewSchema
}

// ── View tree builder ─────────────────────────────────────────────────────────
// Views are stored as a flat node map + childMap so the builder can drop them
// in via insertSubtree without further parsing. The `buildViewSchema` helper
// lets seed authors write the tree in nested form for readability.
interface ViewNodeShape {
  id: string
  type: string
  source: 'primitive' | 'custom_widget' | 'prebuilt_view'
  props: Record<string, unknown>
  bindings: Record<string, string>
  actions: unknown[]
  style: Record<string, unknown>
  responsive: Record<string, unknown>
}

interface ViewSchema {
  nodes: Record<string, ViewNodeShape>
  rootId: string
  childMap: Record<string, string[]>
}

interface ViewSpec {
  id: string
  type: string
  props?: Record<string, unknown>
  children?: ViewSpec[]
}

function buildViewSchema(root: ViewSpec): ViewSchema {
  const nodes: Record<string, ViewNodeShape> = {}
  const childMap: Record<string, string[]> = {}

  function walk(spec: ViewSpec): void {
    nodes[spec.id] = {
      id: spec.id,
      type: spec.type,
      source: 'primitive',
      props: spec.props ?? {},
      bindings: {},
      actions: [],
      style: {},
      responsive: {},
    }
    childMap[spec.id] = (spec.children ?? []).map(c => c.id)
    for (const child of spec.children ?? []) walk(child)
  }

  walk(root)
  return { nodes, rootId: root.id, childMap }
}

// Mark components released within this window as "New" in the builder picker.
// Seeded dates are relative to a fixed anchor so local dev gets deterministic
// badge behavior regardless of when the seed is run.
const RECENT_RELEASE = new Date('2026-04-20T00:00:00Z')

const primitives: PrimitiveDefinition[] = [
  // ── Layout ──────────────────────────────────────────────────────────────────
  {
    name: 'Stack',
    displayName: 'Stack',
    description: 'Flex container for vertical or horizontal layouts',
    category: 'Layout',
    group: 'Layouts',
    icon: 'layout-stack',
    tags: ['layout', 'flex', 'container'],
    propsSchema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['vertical', 'horizontal'], default: 'vertical' },
        gap: { type: 'number', minimum: 0, default: 4 },
        align: { type: 'string', enum: ['start', 'center', 'end', 'stretch'], default: 'start' },
        justify: { type: 'string', enum: ['start', 'center', 'end', 'between', 'around'], default: 'start' },
        wrap: { type: 'boolean', default: false },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { direction: 'vertical', gap: 4, align: 'start', justify: 'start', wrap: false },
  },
  {
    name: 'Grid',
    displayName: 'Grid',
    description: 'CSS grid container with configurable columns and gap',
    category: 'Layout',
    group: 'Layouts',
    icon: 'layout-grid',
    tags: ['layout', 'grid', 'columns'],
    propsSchema: {
      type: 'object',
      properties: {
        columns: { type: 'number', minimum: 1, maximum: 12, default: 2 },
        gap: { type: 'number', minimum: 0, default: 4 },
        align: { type: 'string', enum: ['start', 'center', 'end', 'stretch'], default: 'start' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { columns: 2, gap: 4, align: 'start' },
  },
  {
    name: 'Divider',
    displayName: 'Divider',
    description: 'Horizontal or vertical rule for separating content',
    category: 'Layout',
    group: 'Layouts',
    icon: 'minus',
    tags: ['layout', 'separator', 'rule'],
    propsSchema: {
      type: 'object',
      properties: {
        orientation: { type: 'string', enum: ['horizontal', 'vertical'], default: 'horizontal' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { orientation: 'horizontal' },
  },
  {
    name: 'Card',
    displayName: 'Card',
    description: 'Surface container with optional header and footer',
    category: 'Layout',
    group: 'Layouts',
    icon: 'square',
    tags: ['layout', 'surface', 'container', 'card'],
    propsSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', default: '' },
        description: { type: 'string', default: '' },
        padding: { type: 'string', enum: ['none', 'sm', 'md', 'lg'], default: 'md' },
        shadow: { type: 'string', enum: ['none', 'sm', 'md', 'lg'], default: 'sm' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { padding: 'md', shadow: 'sm' },
  },
  {
    name: 'Tabs',
    displayName: 'Tabs',
    description: 'Tabbed content panels',
    category: 'Layout',
    group: 'Layouts',
    icon: 'panel-top',
    tags: ['layout', 'tabs', 'navigation'],
    propsSchema: {
      type: 'object',
      properties: {
        defaultTab: { type: 'string', default: '' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
            },
          },
          default: [],
        },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { items: [] },
  },
  {
    name: 'Accordion',
    displayName: 'Accordion',
    description: 'Collapsible sections — single or multiple open at once',
    category: 'Layout',
    group: 'Layouts',
    icon: 'chevrons-up-down',
    tags: ['layout', 'accordion', 'collapse', 'expand'],
    releasedAt: RECENT_RELEASE,
    propsSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['single', 'multiple'], default: 'single' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              value: { type: 'string' },
            },
          },
          default: [],
        },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { type: 'single', items: [] },
  },
  {
    name: 'Modal',
    displayName: 'Modal',
    description: 'Accessible dialog with controlled open state',
    category: 'Layout',
    group: 'Layouts',
    icon: 'maximize-2',
    tags: ['layout', 'modal', 'dialog', 'popup'],
    propsSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', default: '' },
        description: { type: 'string', default: '' },
        open: { type: 'boolean', default: false },
        size: { type: 'string', enum: ['sm', 'md', 'lg', 'xl', 'full'], default: 'md' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { open: false, size: 'md' },
  },

  // ── Data ────────────────────────────────────────────────────────────────────
  {
    name: 'DataTable',
    displayName: 'Data Table',
    description: 'Tabular data with sorting, pagination, and search',
    category: 'Data',
    group: 'Data',
    icon: 'table',
    tags: ['data', 'table', 'grid', 'list'],
    propsSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', default: '' },
        columns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              label: { type: 'string' },
              sortable: { type: 'boolean', default: false },
              width: { type: 'string' },
            },
          },
          default: [],
        },
        pageSize: { type: 'number', minimum: 1, maximum: 100, default: 10 },
        striped: { type: 'boolean', default: false },
        searchable: { type: 'boolean', default: false },
        exportable: { type: 'boolean', default: false },
        loading: { type: 'boolean', default: false },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { columns: [], pageSize: 10, striped: false, searchable: false, exportable: false },
  },
  {
    name: 'Chart',
    displayName: 'Chart',
    description: 'Line, bar, pie, and area charts powered by Recharts',
    category: 'Data',
    group: 'Data',
    icon: 'bar-chart-2',
    tags: ['data', 'chart', 'graph', 'visualization'],
    propsSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['line', 'bar', 'pie', 'area'], default: 'bar' },
        xKey: { type: 'string', default: 'x' },
        yKeys: { type: 'array', items: { type: 'string' }, default: ['y'] },
        title: { type: 'string', default: '' },
        height: { type: 'number', default: 300 },
        legend: { type: 'boolean', default: true },
        colors: { type: 'array', items: { type: 'string' }, default: [] },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { type: 'bar', xKey: 'x', yKeys: ['y'], height: 300, legend: true },
  },
  {
    name: 'StatCard',
    displayName: 'Stat Card',
    description: 'Metric card with optional trend indicator',
    category: 'Data',
    group: 'Data',
    icon: 'trending-up',
    tags: ['data', 'metric', 'kpi', 'stat'],
    releasedAt: RECENT_RELEASE,
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        value: { type: 'string', default: '0' },
        previousValue: { type: 'string' },
        trend: { type: 'string', enum: ['up', 'down', 'neutral'], default: 'neutral' },
        format: { type: 'string', enum: ['number', 'currency', 'percent'], default: 'number' },
        loading: { type: 'boolean', default: false },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', value: '0', trend: 'neutral', format: 'number' },
  },
  {
    name: 'Badge',
    displayName: 'Badge',
    description: 'Small status or count indicator',
    category: 'Data',
    group: 'Data',
    icon: 'tag',
    tags: ['data', 'badge', 'status', 'label'],
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        variant: { type: 'string', enum: ['default', 'success', 'warning', 'error', 'info'], default: 'default' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', variant: 'default' },
  },
  {
    name: 'Avatar',
    displayName: 'Avatar',
    description: 'User avatar with image or fallback initials',
    category: 'Data',
    group: 'Data',
    icon: 'user-circle',
    tags: ['data', 'avatar', 'user', 'profile'],
    propsSchema: {
      type: 'object',
      properties: {
        src: { type: 'string', default: '' },
        alt: { type: 'string', default: '' },
        fallback: { type: 'string', default: '' },
        size: { type: 'string', enum: ['xs', 'sm', 'md', 'lg', 'xl'], default: 'md' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { size: 'md' },
  },
  {
    name: 'Tag',
    displayName: 'Tag',
    description: 'Removable label tag',
    category: 'Data',
    group: 'Data',
    icon: 'tag',
    tags: ['data', 'tag', 'chip', 'label'],
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        color: { type: 'string', enum: ['default', 'blue', 'green', 'yellow', 'red', 'purple'], default: 'default' },
        removable: { type: 'boolean', default: false },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', color: 'default', removable: false },
  },

  // ── Input ───────────────────────────────────────────────────────────────────
  {
    name: 'TextInput',
    displayName: 'Text Input',
    description: 'Single-line text input with label and helper text',
    category: 'Input',
    group: 'Inputs',
    icon: 'type',
    tags: ['input', 'form', 'text', 'field'],
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        placeholder: { type: 'string', default: '' },
        helperText: { type: 'string', default: '' },
        error: { type: 'string', default: '' },
        prefix: { type: 'string', default: '' },
        suffix: { type: 'string', default: '' },
        disabled: { type: 'boolean', default: false },
        required: { type: 'boolean', default: false },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', placeholder: '', disabled: false, required: false },
  },
  {
    name: 'NumberInput',
    displayName: 'Number Input',
    description: 'Numeric input with min, max, and step controls',
    category: 'Input',
    group: 'Inputs',
    icon: 'hash',
    tags: ['input', 'form', 'number', 'field'],
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        min: { type: 'number' },
        max: { type: 'number' },
        step: { type: 'number', default: 1 },
        error: { type: 'string', default: '' },
        disabled: { type: 'boolean', default: false },
        required: { type: 'boolean', default: false },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', step: 1, disabled: false, required: false },
  },
  {
    name: 'Select',
    displayName: 'Select',
    description: 'Single-value dropdown select with search',
    category: 'Input',
    group: 'Inputs',
    icon: 'chevron-down-circle',
    tags: ['input', 'form', 'select', 'dropdown'],
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        placeholder: { type: 'string', default: 'Select...' },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: { value: { type: 'string' }, label: { type: 'string' } },
          },
          default: [],
        },
        searchable: { type: 'boolean', default: false },
        disabled: { type: 'boolean', default: false },
        required: { type: 'boolean', default: false },
        error: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', placeholder: 'Select...', options: [], searchable: false, disabled: false },
  },
  {
    name: 'MultiSelect',
    displayName: 'Multi Select',
    description: 'Multiple-value select with tag display',
    category: 'Input',
    group: 'Inputs',
    icon: 'list-checks',
    tags: ['input', 'form', 'select', 'multi'],
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        placeholder: { type: 'string', default: 'Select...' },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: { value: { type: 'string' }, label: { type: 'string' } },
          },
          default: [],
        },
        searchable: { type: 'boolean', default: false },
        disabled: { type: 'boolean', default: false },
        error: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', placeholder: 'Select...', options: [], searchable: false, disabled: false },
  },
  {
    name: 'DatePicker',
    displayName: 'Date Picker',
    description: 'Calendar date or date-range picker',
    category: 'Input',
    group: 'Inputs',
    icon: 'calendar',
    tags: ['input', 'form', 'date', 'calendar'],
    releasedAt: RECENT_RELEASE,
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        mode: { type: 'string', enum: ['single', 'range'], default: 'single' },
        placeholder: { type: 'string', default: 'Pick a date' },
        disabled: { type: 'boolean', default: false },
        required: { type: 'boolean', default: false },
        error: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', mode: 'single', placeholder: 'Pick a date', disabled: false },
  },
  {
    name: 'Checkbox',
    displayName: 'Checkbox',
    description: 'Checkbox input with label and indeterminate state',
    category: 'Input',
    group: 'Inputs',
    icon: 'check-square',
    tags: ['input', 'form', 'checkbox', 'boolean'],
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        checked: { type: 'boolean', default: false },
        indeterminate: { type: 'boolean', default: false },
        disabled: { type: 'boolean', default: false },
        error: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', checked: false, indeterminate: false, disabled: false },
  },
  {
    name: 'Toggle',
    displayName: 'Toggle',
    description: 'Switch toggle with label',
    category: 'Input',
    group: 'Inputs',
    icon: 'toggle-left',
    tags: ['input', 'form', 'toggle', 'switch', 'boolean'],
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        checked: { type: 'boolean', default: false },
        disabled: { type: 'boolean', default: false },
        size: { type: 'string', enum: ['sm', 'md', 'lg'], default: 'md' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', checked: false, disabled: false, size: 'md' },
  },
  {
    name: 'RadioGroup',
    displayName: 'Radio Group',
    description: 'Group of mutually exclusive radio options',
    category: 'Input',
    group: 'Inputs',
    icon: 'circle-dot',
    tags: ['input', 'form', 'radio', 'group'],
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: { value: { type: 'string' }, label: { type: 'string' } },
          },
          default: [],
        },
        orientation: { type: 'string', enum: ['horizontal', 'vertical'], default: 'vertical' },
        disabled: { type: 'boolean', default: false },
        error: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', options: [], orientation: 'vertical', disabled: false },
  },
  {
    name: 'Textarea',
    displayName: 'Textarea',
    description: 'Multi-line text input with resize and character count',
    category: 'Input',
    group: 'Inputs',
    icon: 'align-left',
    tags: ['input', 'form', 'textarea', 'text', 'multiline'],
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        placeholder: { type: 'string', default: '' },
        rows: { type: 'number', minimum: 1, default: 3 },
        maxLength: { type: 'number' },
        resize: { type: 'string', enum: ['none', 'vertical', 'horizontal', 'both'], default: 'vertical' },
        disabled: { type: 'boolean', default: false },
        required: { type: 'boolean', default: false },
        error: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', placeholder: '', rows: 3, resize: 'vertical', disabled: false },
  },
  {
    name: 'FileUpload',
    displayName: 'File Upload',
    description: 'Drag-and-drop file upload with progress',
    category: 'Input',
    group: 'Inputs',
    icon: 'upload-cloud',
    tags: ['input', 'form', 'file', 'upload'],
    releasedAt: RECENT_RELEASE,
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '' },
        accept: { type: 'string', default: '*' },
        maxSizeMb: { type: 'number', default: 10 },
        multiple: { type: 'boolean', default: false },
        disabled: { type: 'boolean', default: false },
        error: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: '', accept: '*', maxSizeMb: 10, multiple: false, disabled: false },
  },

  // ── Action ──────────────────────────────────────────────────────────────────
  {
    name: 'Button',
    displayName: 'Button',
    description: 'Action button with variants and loading state',
    category: 'Action',
    group: 'Buttons',
    icon: 'square',
    tags: ['action', 'button', 'click', 'cta'],
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: 'Button' },
        variant: { type: 'string', enum: ['default', 'outline', 'ghost', 'destructive', 'link'], default: 'default' },
        size: { type: 'string', enum: ['sm', 'md', 'lg', 'icon'], default: 'md' },
        loading: { type: 'boolean', default: false },
        disabled: { type: 'boolean', default: false },
        type: { type: 'string', enum: ['button', 'submit', 'reset'], default: 'button' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: 'Button', variant: 'default', size: 'md', loading: false, disabled: false, type: 'button' },
  },
  {
    name: 'IconButton',
    displayName: 'Icon Button',
    description: 'Square icon button with accessible label',
    category: 'Action',
    group: 'Buttons',
    icon: 'circle',
    tags: ['action', 'button', 'icon'],
    releasedAt: RECENT_RELEASE,
    propsSchema: {
      type: 'object',
      properties: {
        icon: { type: 'string', default: 'plus' },
        ariaLabel: { type: 'string', default: '' },
        variant: { type: 'string', enum: ['default', 'outline', 'ghost', 'destructive'], default: 'ghost' },
        size: { type: 'string', enum: ['sm', 'md', 'lg'], default: 'md' },
        loading: { type: 'boolean', default: false },
        disabled: { type: 'boolean', default: false },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { icon: 'plus', ariaLabel: '', variant: 'ghost', size: 'md', loading: false, disabled: false },
  },
  {
    name: 'Link',
    displayName: 'Link',
    description: 'Navigable link with variant styles',
    category: 'Action',
    group: 'Buttons',
    icon: 'external-link',
    tags: ['action', 'link', 'navigate', 'anchor'],
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: 'Click here' },
        href: { type: 'string', default: '#' },
        target: { type: 'string', enum: ['_self', '_blank'], default: '_self' },
        variant: { type: 'string', enum: ['default', 'muted', 'destructive'], default: 'default' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: 'Click here', href: '#', target: '_self', variant: 'default' },
  },
  {
    name: 'DropdownMenu',
    displayName: 'Dropdown Menu',
    description: 'Contextual menu triggered by a button',
    category: 'Action',
    group: 'Buttons',
    icon: 'menu',
    tags: ['action', 'dropdown', 'menu', 'context'],
    releasedAt: RECENT_RELEASE,
    propsSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', default: 'Actions' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              icon: { type: 'string' },
              variant: { type: 'string', enum: ['default', 'destructive'], default: 'default' },
              disabled: { type: 'boolean', default: false },
            },
          },
          default: [],
        },
        disabled: { type: 'boolean', default: false },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { label: 'Actions', items: [], disabled: false },
  },

  // ── Feedback ────────────────────────────────────────────────────────────────
  {
    name: 'Alert',
    displayName: 'Alert',
    description: 'Informational alert banner with dismiss support',
    category: 'Feedback',
    group: 'Feedback',
    icon: 'alert-circle',
    tags: ['feedback', 'alert', 'notification', 'banner'],
    propsSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', default: '' },
        description: { type: 'string', default: '' },
        variant: { type: 'string', enum: ['info', 'success', 'warning', 'error'], default: 'info' },
        dismissible: { type: 'boolean', default: false },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { title: '', description: '', variant: 'info', dismissible: false },
  },
  {
    name: 'Toast',
    displayName: 'Toast',
    description: 'Temporary notification toast message',
    category: 'Feedback',
    group: 'Feedback',
    icon: 'bell',
    tags: ['feedback', 'toast', 'notification', 'snackbar'],
    propsSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', default: '' },
        type: { type: 'string', enum: ['info', 'success', 'warning', 'error'], default: 'info' },
        duration: { type: 'number', default: 3000 },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { message: '', type: 'info', duration: 3000 },
  },
  {
    name: 'Spinner',
    displayName: 'Spinner',
    description: 'Loading spinner with size variants',
    category: 'Feedback',
    group: 'Feedback',
    icon: 'loader',
    tags: ['feedback', 'spinner', 'loading', 'progress'],
    propsSchema: {
      type: 'object',
      properties: {
        size: { type: 'string', enum: ['xs', 'sm', 'md', 'lg', 'xl'], default: 'md' },
        label: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { size: 'md', label: '' },
  },
  {
    name: 'Skeleton',
    displayName: 'Skeleton',
    description: 'Loading placeholder skeleton block',
    category: 'Feedback',
    group: 'Feedback',
    icon: 'square-dashed',
    tags: ['feedback', 'skeleton', 'loading', 'placeholder'],
    propsSchema: {
      type: 'object',
      properties: {
        width: { type: 'string', default: '100%' },
        height: { type: 'string', default: '1rem' },
        rounded: { type: 'string', enum: ['none', 'sm', 'md', 'lg', 'full'], default: 'md' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { width: '100%', height: '1rem', rounded: 'md' },
  },
  {
    name: 'EmptyState',
    displayName: 'Empty State',
    description: 'Empty state with icon, title, description, and optional action',
    category: 'Feedback',
    group: 'Feedback',
    icon: 'inbox',
    tags: ['feedback', 'empty', 'placeholder', 'no-data'],
    propsSchema: {
      type: 'object',
      properties: {
        icon: { type: 'string', default: 'inbox' },
        title: { type: 'string', default: 'No data' },
        description: { type: 'string', default: '' },
        actionLabel: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { icon: 'inbox', title: 'No data', description: '' },
  },
  {
    name: 'ErrorBoundary',
    displayName: 'Error Boundary',
    description: 'Catches component errors and shows a fallback',
    category: 'Feedback',
    group: 'Feedback',
    icon: 'shield-alert',
    tags: ['feedback', 'error', 'boundary', 'fallback'],
    propsSchema: {
      type: 'object',
      properties: {
        fallbackTitle: { type: 'string', default: 'Something went wrong' },
        showDetails: { type: 'boolean', default: false },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { fallbackTitle: 'Something went wrong', showDetails: false },
  },

  // ── Typography ───────────────────────────────────────────────────────────────
  {
    name: 'Heading',
    displayName: 'Heading',
    description: 'Semantic heading — h1 through h6',
    category: 'Typography',
    group: 'Typography',
    icon: 'heading',
    tags: ['typography', 'heading', 'title', 'h1', 'h2'],
    propsSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', default: 'Heading' },
        level: { type: 'string', enum: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'], default: 'h2' },
        size: { type: 'string', enum: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'], default: 'lg' },
        weight: { type: 'string', enum: ['normal', 'medium', 'semibold', 'bold'], default: 'semibold' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { text: 'Heading', level: 'h2', size: 'lg', weight: 'semibold' },
  },
  {
    name: 'Text',
    displayName: 'Text',
    description: 'Paragraph or inline text with size variants',
    category: 'Typography',
    group: 'Typography',
    icon: 'type',
    tags: ['typography', 'text', 'paragraph', 'body'],
    propsSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', default: '' },
        as: { type: 'string', enum: ['p', 'span', 'div', 'label'], default: 'p' },
        size: { type: 'string', enum: ['xs', 'sm', 'md', 'lg'], default: 'md' },
        muted: { type: 'boolean', default: false },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { content: '', as: 'p', size: 'md', muted: false },
  },
  {
    name: 'RichText',
    displayName: 'Rich Text',
    description: 'Rich text display powered by TipTap',
    category: 'Typography',
    group: 'Typography',
    icon: 'file-text',
    tags: ['typography', 'richtext', 'html', 'editor'],
    propsSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', default: '' },
        className: { type: 'string', default: '' },
      },
    },
    defaultProps: { content: '' },
  },
]

// ── Prebuilt views ────────────────────────────────────────────────────────────
// Compositions of widgets saved in the library. FDEs can drag these onto the
// canvas to get a full page layout rather than assembling from scratch.
// Views have no configurable props — they are templates, expanded into
// individual editable child components on import. propsSchema/defaultProps
// stay empty; the tree lives in `viewSchema`.
const EMPTY_PROPS_SCHEMA = { type: 'object', properties: {} } as const

const views: PrimitiveDefinition[] = [
  {
    name: 'HomeView',
    displayName: 'Home',
    description: 'Dashboard landing page — KPI stat cards, recent activity table, and welcome heading. Imports as editable components.',
    category: 'Logistics',
    group: 'Logistics',
    icon: 'home',
    tags: ['view', 'home', 'dashboard', 'kpi', 'landing'],
    propsSchema: EMPTY_PROPS_SCHEMA,
    defaultProps: {},
    viewSchema: buildViewSchema({
      id: 'home-root',
      type: 'Stack',
      props: { direction: 'vertical', gap: 6, align: 'stretch', justify: 'start' },
      children: [
        { id: 'home-h1', type: 'Heading', props: { text: 'Welcome', level: 'h1', size: '2xl', weight: 'bold' } },
        {
          id: 'home-stats',
          type: 'Grid',
          props: { columns: 4, gap: 4, align: 'stretch' },
          children: [
            { id: 'home-stat-1', type: 'StatCard', props: { label: 'Active Shipments', value: '128', trend: 'neutral', format: 'number' } },
            { id: 'home-stat-2', type: 'StatCard', props: { label: 'In Transit', value: '42', trend: 'up', format: 'number' } },
            { id: 'home-stat-3', type: 'StatCard', props: { label: 'Delivered Today', value: '17', trend: 'up', format: 'number' } },
            { id: 'home-stat-4', type: 'StatCard', props: { label: 'Exceptions', value: '3', trend: 'down', format: 'number' } },
          ],
        },
        { id: 'home-h2', type: 'Heading', props: { text: 'Recent Activity', level: 'h2', size: 'lg', weight: 'semibold' } },
        {
          id: 'home-table',
          type: 'DataTable',
          props: {
            title: 'Recent Shipments',
            columns: [
              { key: 'id', label: 'Shipment ID', sortable: true },
              { key: 'origin', label: 'Origin', sortable: true },
              { key: 'destination', label: 'Destination', sortable: true },
              { key: 'status', label: 'Status', sortable: false },
            ],
            pageSize: 10,
            striped: true,
            searchable: false,
            exportable: false,
          },
        },
      ],
    }),
  },
  {
    name: 'ShipmentListView',
    displayName: 'Shipment List',
    description: 'Paginated table of shipments with search, status filter, and date-range filter. Imports as editable components.',
    category: 'Logistics',
    group: 'Logistics',
    icon: 'list',
    tags: ['view', 'shipment', 'list', 'table', 'logistics'],
    propsSchema: EMPTY_PROPS_SCHEMA,
    defaultProps: {},
    viewSchema: buildViewSchema({
      id: 'shiplist-root',
      type: 'Stack',
      props: { direction: 'vertical', gap: 4, align: 'stretch', justify: 'start' },
      children: [
        { id: 'shiplist-h1', type: 'Heading', props: { text: 'Shipments', level: 'h1', size: '2xl', weight: 'bold' } },
        {
          id: 'shiplist-filters',
          type: 'Stack',
          props: { direction: 'horizontal', gap: 3, align: 'center', justify: 'start', wrap: true },
          children: [
            { id: 'shiplist-search', type: 'TextInput', props: { label: '', placeholder: 'Search shipments…', prefix: '', suffix: '' } },
            {
              id: 'shiplist-status',
              type: 'Select',
              props: {
                label: '',
                placeholder: 'Status',
                options: [
                  { value: 'all', label: 'All' },
                  { value: 'in_transit', label: 'In Transit' },
                  { value: 'delivered', label: 'Delivered' },
                  { value: 'delayed', label: 'Delayed' },
                  { value: 'cancelled', label: 'Cancelled' },
                ],
                searchable: false,
              },
            },
            { id: 'shiplist-date', type: 'DatePicker', props: { label: '', mode: 'range', placeholder: 'Date range' } },
          ],
        },
        {
          id: 'shiplist-table',
          type: 'DataTable',
          props: {
            title: '',
            columns: [
              { key: 'id', label: 'Shipment ID', sortable: true },
              { key: 'origin', label: 'Origin', sortable: true },
              { key: 'destination', label: 'Destination', sortable: true },
              { key: 'eta', label: 'ETA', sortable: true },
              { key: 'status', label: 'Status', sortable: false },
            ],
            pageSize: 20,
            striped: true,
            searchable: true,
            exportable: true,
          },
        },
      ],
    }),
  },
  {
    name: 'ShipmentDetailsView',
    displayName: 'Shipment Details',
    description: 'Full detail page for a single shipment — header with status badge, overview / status cards, timeline table, and documents table.',
    category: 'Logistics',
    group: 'Logistics',
    icon: 'package',
    tags: ['view', 'shipment', 'details', 'logistics', 'timeline'],
    propsSchema: EMPTY_PROPS_SCHEMA,
    defaultProps: {},
    viewSchema: buildViewSchema({
      id: 'shipdet-root',
      type: 'Stack',
      props: { direction: 'vertical', gap: 6, align: 'stretch', justify: 'start' },
      children: [
        {
          id: 'shipdet-header',
          type: 'Stack',
          props: { direction: 'horizontal', gap: 3, align: 'center', justify: 'between' },
          children: [
            { id: 'shipdet-h1', type: 'Heading', props: { text: 'Shipment SHP-00128', level: 'h1', size: '2xl', weight: 'bold' } },
            { id: 'shipdet-badge', type: 'Badge', props: { label: 'In Transit', variant: 'info' } },
          ],
        },
        {
          id: 'shipdet-grid',
          type: 'Grid',
          props: { columns: 2, gap: 4, align: 'stretch' },
          children: [
            { id: 'shipdet-overview', type: 'Card', props: { title: 'Overview', description: 'Origin, destination, and carrier details', padding: 'md', shadow: 'sm' } },
            { id: 'shipdet-status', type: 'Card', props: { title: 'Status', description: 'Current location and ETA', padding: 'md', shadow: 'sm' } },
          ],
        },
        { id: 'shipdet-h2', type: 'Heading', props: { text: 'Timeline', level: 'h2', size: 'lg', weight: 'semibold' } },
        {
          id: 'shipdet-timeline',
          type: 'DataTable',
          props: {
            title: '',
            columns: [
              { key: 'timestamp', label: 'Time', sortable: true },
              { key: 'event', label: 'Event', sortable: false },
              { key: 'location', label: 'Location', sortable: false },
            ],
            pageSize: 10,
            striped: false,
            searchable: false,
            exportable: false,
          },
        },
        { id: 'shipdet-h3', type: 'Heading', props: { text: 'Documents', level: 'h2', size: 'lg', weight: 'semibold' } },
        {
          id: 'shipdet-documents',
          type: 'DataTable',
          props: {
            title: '',
            columns: [
              { key: 'name', label: 'Document', sortable: true },
              { key: 'type', label: 'Type', sortable: true },
              { key: 'uploadedAt', label: 'Uploaded', sortable: true },
            ],
            pageSize: 5,
            striped: false,
            searchable: false,
            exportable: true,
          },
        },
      ],
    }),
  },
]

// ── Built-in widgets ──────────────────────────────────────────────────────────
// Each widget owns its own seed entry inside @portal/widgets/seed. To add a
// new widget, append it to widgetSeedEntries in the package — no edit here.
const widgets: PrimitiveDefinition[] = widgetSeedEntries.map(entry => ({
  name: entry.name,
  displayName: entry.displayName,
  description: entry.description,
  category: entry.category,
  icon: entry.icon,
  tags: [...entry.tags],
  propsSchema: entry.propsSchema as Record<string, unknown>,
  defaultProps: entry.defaultProps,
}))

async function seed() {
  console.log('Seeding component registry...')

  let created = 0
  let updated = 0
  let skipped = 0

  for (const primitive of primitives) {
    const existing = await prisma.registryEntry.findFirst({
      where: { name: primitive.name, scope: 'COMMON' },
      include: {
        versions: {
          orderBy: { publishedAt: 'desc' },
          take: 1,
        },
      },
    })

    if (existing) {
      // Keep the current version row in sync with the seed definition so
      // re-running the seed after schema changes (e.g. new `group` /
      // `releasedAt` fields) backfills existing deployments without needing
      // a bespoke migration script. Only metadata is touched; propsSchema
      // and defaultProps are left alone to avoid surprising version drift.
      const currentVersion = existing.versions[0]
      if (currentVersion) {
        await prisma.registryEntryVersion.update({
          where: { id: currentVersion.id },
          data: {
            displayName: primitive.displayName,
            description: primitive.description,
            category: primitive.category,
            group: primitive.group ?? null,
            icon: primitive.icon,
            tags: primitive.tags,
            releasedAt: primitive.releasedAt ?? null,
          },
        })
        updated++
      }
      continue
    }

    const entry = await prisma.registryEntry.create({
      data: {
        name: primitive.name,
        type: 'PRIMITIVE',
        scope: 'COMMON',
        status: 'ACTIVE',
        currentVersion: '1.0.0',
        sourceType: 'INTERNAL',
        ownedBy: 'platform',
        createdBy: 'seed',
      },
    })

    await prisma.registryEntryVersion.create({
      data: {
        entryId: entry.id,
        version: '1.0.0',
        propsSchema: primitive.propsSchema as Prisma.InputJsonValue,
        defaultProps: primitive.defaultProps as Prisma.InputJsonValue,
        displayName: primitive.displayName,
        description: primitive.description,
        category: primitive.category,
        group: primitive.group ?? null,
        icon: primitive.icon,
        tags: primitive.tags,
        releasedAt: primitive.releasedAt ?? null,
        publishedBy: 'seed',
      },
    })

    created++
  }

  for (const widget of widgets) {
    const existing = await prisma.registryEntry.findFirst({
      where: { name: widget.name, scope: 'COMMON' },
    })

    if (existing) {
      skipped++
      continue
    }

    const entry = await prisma.registryEntry.create({
      data: {
        name: widget.name,
        type: 'CUSTOM_WIDGET',
        scope: 'COMMON',
        status: 'ACTIVE',
        currentVersion: '1.0.0',
        sourceType: 'INTERNAL',
        ownedBy: 'platform',
        createdBy: 'seed',
      },
    })

    await prisma.registryEntryVersion.create({
      data: {
        entryId: entry.id,
        version: '1.0.0',
        propsSchema: widget.propsSchema as Prisma.InputJsonValue,
        defaultProps: widget.defaultProps as Prisma.InputJsonValue,
        displayName: widget.displayName,
        description: widget.description,
        category: widget.category,
        icon: widget.icon,
        tags: widget.tags,
        publishedBy: 'seed',
      },
    })

    created++
  }

  for (const view of views) {
    const existing = await prisma.registryEntry.findFirst({
      where: { name: view.name, scope: 'COMMON' },
      include: {
        versions: {
          orderBy: { publishedAt: 'desc' },
          take: 1,
        },
      },
    })

    if (existing) {
      const currentVersion = existing.versions[0]
      if (currentVersion) {
        // Re-running the seed should refresh the stored tree as well — view
        // authors iterate on the composition; without this they'd have to
        // bump the version row manually.
        await prisma.registryEntryVersion.update({
          where: { id: currentVersion.id },
          data: {
            displayName: view.displayName,
            description: view.description,
            category: view.category,
            group: view.group ?? null,
            icon: view.icon,
            tags: view.tags,
            propsSchema: view.propsSchema as Prisma.InputJsonValue,
            defaultProps: view.defaultProps as Prisma.InputJsonValue,
            viewSchema: (view.viewSchema ?? null) as Prisma.InputJsonValue,
          },
        })
        updated++
      }
      continue
    }

    const entry = await prisma.registryEntry.create({
      data: {
        name: view.name,
        type: 'PREBUILT_VIEW',
        scope: 'COMMON',
        status: 'ACTIVE',
        currentVersion: '1.0.0',
        sourceType: 'COMPOSED',
        ownedBy: 'platform',
        createdBy: 'seed',
      },
    })

    await prisma.registryEntryVersion.create({
      data: {
        entryId: entry.id,
        version: '1.0.0',
        propsSchema: view.propsSchema as Prisma.InputJsonValue,
        defaultProps: view.defaultProps as Prisma.InputJsonValue,
        viewSchema: (view.viewSchema ?? null) as Prisma.InputJsonValue,
        displayName: view.displayName,
        description: view.description,
        category: view.category,
        group: view.group ?? null,
        icon: view.icon,
        tags: view.tags,
        publishedBy: 'seed',
      },
    })

    created++
  }

  console.log(`Registry seeded: ${created} created, ${updated} updated, ${skipped} skipped`)
  console.log(`Total primitives: ${primitives.length}, widgets: ${widgets.length}, views: ${views.length}`)
}

seed()
  .catch(err => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
