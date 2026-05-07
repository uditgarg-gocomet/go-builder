// ── /demo/cancel-shipment ────────────────────────────────────────────────────
// Self-contained demo page for the CancelShipmentModal widget. Hardcodes a
// PageSchema and mounts it through the same provider stack production pages
// use — but skips the deployment / DB fetch entirely so we can iterate on
// the widget without a publish round-trip.
//
// Runtime URL: http://localhost:3002/demo/cancel-shipment

import React from 'react'
import type { PageSchema } from '@portal/core'
import { ThemeProvider } from '@/lib/theme/themeInjector'
import { AuthProvider } from '@/lib/auth/authContext'
import { BindingProvider } from '@/lib/binding/bindingContext'
import { ActionProvider } from '@/lib/actions/actionContext'
import { SchemaRenderer } from '@/lib/renderer/schemaRenderer'
import { EventLog } from './EventLog'

const demoSchema: PageSchema = {
  pageId: 'demo-cancel-shipment',
  appId: 'demo',
  version: '1.0.0',
  meta: {
    title: 'CancelShipmentModal Demo',
    slug: 'cancel-shipment',
    order: 0,
    auth: { required: false, groups: [] },
  },
  state: [
    { name: 'isCancelOpen',    type: 'boolean', defaultValue: false },
    { name: 'mockMode',        type: 'string',  defaultValue: 'success' },
    { name: 'demoWorkflowId',  type: 'string',  defaultValue: 'WF-DEMO-1' },
  ],
  dataSources: [],
  forms: [],
  params: [],
  actions: [
    // Atomic state-mutator the chained actions terminate on.
    { id: 'setOpen', name: 'Open modal', type: 'SET_STATE', config: { key: 'isCancelOpen', value: true } },

    // Each entry-point flips `mockMode` then chains to `setOpen` via the
    // built-in `outcomes.onSuccess` mechanism. Avoids RUN_SEQUENCE which has
    // a known schema/executor mismatch (schema declares `steps`, executor
    // reads `actions`).
    {
      id: 'openSuccess',
      name: 'Open (Success Mode)',
      type: 'SET_STATE',
      config: { key: 'mockMode', value: 'success' },
      outcomes: { onSuccess: ['setOpen'] },
    },
    {
      id: 'openFailure',
      name: 'Open (Failure Mode)',
      type: 'SET_STATE',
      config: { key: 'mockMode', value: 'failure' },
      outcomes: { onSuccess: ['setOpen'] },
    },
    { id: 'closeModal', name: 'Close modal', type: 'SET_STATE', config: { key: 'isCancelOpen', value: false } },
  ],
  layout: {
    id: 'root',
    type: 'Stack',
    source: 'primitive',
    props: { direction: 'vertical', gap: 6 },
    bindings: {},
    actions: [],
    style: { padding: '32px', maxWidth: '720px', margin: '0 auto' },
    responsive: {},
    children: [
      {
        id: 'heading',
        type: 'Heading',
        source: 'primitive',
        props: { text: 'CancelShipmentModal — Demo', level: 'h1' },
        bindings: {}, actions: [], style: {}, responsive: {}, children: [],
      },
      {
        id: 'subtitle',
        type: 'Text',
        source: 'primitive',
        props: {
          content: 'Open the modal in either mode, pick a reason, and watch the eventBus log react.',
          size: 'sm',
          muted: true,
        },
        bindings: {}, actions: [], style: {}, responsive: {}, children: [],
      },
      {
        id: 'controls',
        type: 'Stack',
        source: 'primitive',
        props: { direction: 'horizontal', gap: 3 },
        bindings: {}, actions: [], style: { paddingTop: '8px' }, responsive: {},
        children: [
          {
            id: 'btnSuccess',
            type: 'Button',
            source: 'primitive',
            props: { label: 'Cancel Shipment (Success)', variant: 'destructive' },
            bindings: {},
            actions: [{ trigger: 'onClick', actionId: 'openSuccess' }],
            style: {}, responsive: {}, children: [],
          },
          {
            id: 'btnFailure',
            type: 'Button',
            source: 'primitive',
            props: { label: 'Cancel Shipment (Failure)', variant: 'outline' },
            bindings: {},
            actions: [{ trigger: 'onClick', actionId: 'openFailure' }],
            style: {}, responsive: {}, children: [],
          },
        ],
      },
      {
        id: 'cancelModal',
        type: 'CancelShipmentModal',
        source: 'custom_widget',
        props: { mockDelayMs: 800 },
        bindings: {
          open:       '{{state.isCancelOpen}}',
          mockMode:   '{{state.mockMode}}',
          workflowId: '{{state.demoWorkflowId}}',
        },
        actions: [
          { trigger: 'onClose', actionId: 'closeModal' },
        ],
        style: {}, responsive: {}, children: [],
      },
    ],
  },
}

export default function DemoCancelShipmentPage(): React.ReactElement {
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
            pageId="demo-cancel-shipment"
            userId="demo-user"
          >
            <main className="min-h-screen bg-muted/20">
              <div className="mx-auto max-w-3xl px-6 py-8 flex flex-col gap-6">
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
