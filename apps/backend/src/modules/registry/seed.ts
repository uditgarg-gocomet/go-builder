import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface PrimitiveDefinition {
  name: string
  displayName: string
  description: string
  category: string
  icon: string
  tags: string[]
  propsSchema: Record<string, unknown>
  defaultProps: Record<string, unknown>
}

const primitives: PrimitiveDefinition[] = [
  // ── Layout ──────────────────────────────────────────────────────────────────
  {
    name: 'Stack',
    displayName: 'Stack',
    description: 'Flex container for vertical or horizontal layouts',
    category: 'Layout',
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
    icon: 'chevrons-up-down',
    tags: ['layout', 'accordion', 'collapse', 'expand'],
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
    icon: 'trending-up',
    tags: ['data', 'metric', 'kpi', 'stat'],
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
    icon: 'calendar',
    tags: ['input', 'form', 'date', 'calendar'],
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
    icon: 'upload-cloud',
    tags: ['input', 'form', 'file', 'upload'],
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
    icon: 'circle',
    tags: ['action', 'button', 'icon'],
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
    icon: 'menu',
    tags: ['action', 'dropdown', 'menu', 'context'],
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

async function seed() {
  console.log('Seeding component registry...')

  let created = 0
  let skipped = 0

  for (const primitive of primitives) {
    const existing = await prisma.registryEntry.findFirst({
      where: { name: primitive.name, scope: 'COMMON' },
    })

    if (existing) {
      skipped++
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
        propsSchema: primitive.propsSchema,
        defaultProps: primitive.defaultProps,
        displayName: primitive.displayName,
        description: primitive.description,
        category: primitive.category,
        icon: primitive.icon,
        tags: primitive.tags,
        publishedBy: 'seed',
      },
    })

    created++
  }

  console.log(`Registry seeded: ${created} created, ${skipped} already exist`)
  console.log(`Total primitives: ${primitives.length}`)
}

seed()
  .catch(err => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
