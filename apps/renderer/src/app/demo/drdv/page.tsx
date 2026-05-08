// ── /demo/drdv ──────────────────────────────────────────────────────────────
// Self-contained demo for DRDVModal. Hardcodes a PageSchema with a small
// "Pending Reviews" table — three rows representing shipments awaiting
// document review — plus a single DRDV modal mounted once at the bottom.
// Clicking any row's "Review" CTA opens the modal; mode-toggle buttons up
// top let you flip between mock and real API.
//
// Runtime URL: http://localhost:3002/demo/drdv

import React from 'react'
import type { PageSchema, ComponentNode } from '@portal/core'
import { ThemeProvider } from '@/lib/theme/themeInjector'
import { AuthProvider } from '@/lib/auth/authContext'
import { BindingProvider } from '@/lib/binding/bindingContext'
import { ActionProvider } from '@/lib/actions/actionContext'
import { SchemaRenderer } from '@/lib/renderer/schemaRenderer'
import { EventLog } from './EventLog'

// ── Helper: build a "table row" out of primitives ───────────────────────────
// Renders as a horizontal Stack with field cells + a Review button on the
// right. We inline-define this so the schema literal stays readable.

interface RowDef {
  id: string
  workflowRef: string
  documentName: string
  status: string
  statusColour: string
}

const blank: {
  bindings: Record<string, string>
  actions: ComponentNode['actions']
  style: Record<string, unknown>
  responsive: ComponentNode['responsive']
  children: ComponentNode[]
} = { bindings: {}, actions: [], style: {}, responsive: {}, children: [] }

function buildRow(row: RowDef): ComponentNode {
  return {
    id: `row-${row.id}`,
    type: 'Stack',
    source: 'primitive',
    props: { direction: 'horizontal', gap: 3, align: 'center' },
    bindings: {},
    actions: [],
    style: {
      padding: '12px 16px',
      borderBottom: '1px solid #e5e7eb',
      alignItems: 'center',
    },
    responsive: {},
    children: [
      // Workflow ref column
      {
        id: `${row.id}-ref`,
        type: 'Text',
        source: 'primitive',
        props: { content: row.workflowRef, size: 'sm' },
        ...blank,
        style: { minWidth: '160px', fontFamily: 'monospace', fontWeight: 500 },
      },
      // Document name column
      {
        id: `${row.id}-doc`,
        type: 'Text',
        source: 'primitive',
        props: { content: row.documentName, size: 'sm' },
        ...blank,
        style: { flex: '1 1 auto' },
      },
      // Status badge
      {
        id: `${row.id}-status`,
        type: 'Badge',
        source: 'primitive',
        props: { label: row.status, variant: row.statusColour },
        ...blank,
        style: { minWidth: '120px' },
      },
      // Review CTA — fires the same action; demo only has one swaId
      {
        id: `${row.id}-review`,
        type: 'Button',
        source: 'primitive',
        props: { label: 'Review', variant: 'outline', size: 'sm' },
        bindings: {},
        actions: [{ trigger: 'onClick', actionId: 'setOpen' }],
        style: {},
        responsive: {},
        children: [],
      },
    ],
  } as ComponentNode
}

const rows: RowDef[] = [
  {
    id: 'r1',
    workflowRef: 'WF-2024-0042',
    documentName: 'Draft Bill of Lading',
    status: 'Validation pending',
    statusColour: 'warning',
  },
  {
    id: 'r2',
    workflowRef: 'WF-2024-0043',
    documentName: 'Draft Bill of Lading',
    status: 'Validation error',
    statusColour: 'destructive',
  },
  {
    id: 'r3',
    workflowRef: 'WF-2024-0044',
    documentName: 'Draft Bill of Lading',
    status: 'Review pending',
    statusColour: 'default',
  },
]

const demoSchema: PageSchema = {
  pageId: 'demo-drdv',
  appId: 'demo',
  version: '1.0.0',
  meta: {
    title: 'DRDVModal Demo',
    slug: 'drdv',
    order: 0,
    auth: { required: false, groups: [] },
  },
  state: [
    { name: 'isDrdvOpen', type: 'boolean', defaultValue: false },
  ],
  dataSources: [],
  forms: [],
  params: [],
  actions: [
    { id: 'setOpen',   name: 'Open modal',  type: 'SET_STATE', config: { key: 'isDrdvOpen', value: true } },
    { id: 'closeDrdv', name: 'Close modal', type: 'SET_STATE', config: { key: 'isDrdvOpen', value: false } },
  ],
  layout: {
    id: 'root',
    type: 'Stack',
    source: 'primitive',
    props: { direction: 'vertical', gap: 6 },
    bindings: {}, actions: [], responsive: {},
    style: { padding: '32px', maxWidth: '960px', margin: '0 auto' },
    children: [
      {
        id: 'heading',
        type: 'Heading',
        source: 'primitive',
        props: { text: 'DRDVModal — Demo', level: 'h1' },
        ...blank,
      },
      {
        id: 'subtitle',
        type: 'Text',
        source: 'primitive',
        props: {
          content:
            'A small "shipments awaiting review" table. Click any Review button to open DRDV — calls hit the real gocomet staging API via the renderer proxy.',
          size: 'sm',
          muted: true,
        },
        ...blank,
      },
      // ── "Pending Reviews" table ──────────────────────────────────────
      {
        id: 'table-card',
        type: 'Card',
        source: 'primitive',
        props: { title: 'Pending document reviews', padding: 'none', shadow: 'sm' },
        bindings: {}, actions: [], responsive: {},
        style: {},
        children: [
          // Table header row
          {
            id: 'table-head',
            type: 'Stack',
            source: 'primitive',
            props: { direction: 'horizontal', gap: 3, align: 'center' },
            bindings: {}, actions: [], responsive: {},
            style: {
              padding: '8px 16px',
              backgroundColor: '#f1f5f9',
              borderBottom: '1px solid #e5e7eb',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#64748b',
            },
            children: [
              { id: 'h-ref',    type: 'Text', source: 'primitive', props: { content: 'Workflow', size: 'sm' }, ...blank, style: { minWidth: '160px' } },
              { id: 'h-doc',    type: 'Text', source: 'primitive', props: { content: 'Document',  size: 'sm' }, ...blank, style: { flex: '1 1 auto' } },
              { id: 'h-status', type: 'Text', source: 'primitive', props: { content: 'Status',    size: 'sm' }, ...blank, style: { minWidth: '120px' } },
              { id: 'h-actn',   type: 'Text', source: 'primitive', props: { content: 'Action',    size: 'sm' }, ...blank, style: { minWidth: '88px' } },
            ],
          },
          // Body rows
          ...rows.map(buildRow),
        ],
      },
      // ── DRDV modal — mounted once, opens via state ─────────────────
      {
        id: 'drdv-modal',
        type: 'DRDVModal',
        source: 'custom_widget',
        props: {
          // Static config — we keep one demo set; in a real page
          // these would bind per-row.
          swaId: 'de3c4868-57f9-48bd-b8c1-03a4c35b56cb',
          documentBucketId: 'draft_bill_of_lading',
          checklistTags: ['document_verification_step'],
          checklistId: '19.11',
          apiMode: 'real',
          mockDelayMs: 800,
          hideCtas: false,
        },
        bindings: {
          open: '{{state.isDrdvOpen}}',
        },
        actions: [
          { trigger: 'onClose', actionId: 'closeDrdv' },
          { trigger: 'onVerify', actionId: 'closeDrdv' },
          { trigger: 'onReject', actionId: 'closeDrdv' },
          { trigger: 'onReverify', actionId: 'closeDrdv' },
        ],
        style: {}, responsive: {}, children: [],
      },
    ],
  },
}

export default function DemoDRDVPage(): React.ReactElement {
  return (
    <ThemeProvider>
      <AuthProvider initialUserId="demo-user">
        <BindingProvider
          schema={demoSchema}
          urlParams={{}}
          userId="demo-user"
          userEmail="demo@example.com"
          userGroups={['demo']}
          appId="demo"
        >
          <ActionProvider
            schema={demoSchema}
            appId="demo"
            pageId="demo-drdv"
            userId="demo-user"
          >
            <main className="min-h-screen bg-muted/20">
              <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col gap-6">
                <SchemaRenderer schema={demoSchema} />
                <EventLog />
              </div>
            </main>
          </ActionProvider>
        </BindingProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
