// Mocked auth roles for the POC.
//
// Activated by passing `?role=<name>` on any renderer URL (dev/POC only — see
// `authContext.tsx` where this is consumed). When a role is active its groups
// override `user.groups` from the JWT, so the renderer's visibility hook and
// each widget's permission hook see the mocked role consistently.
//
// Acceptance criterion: "Switching role in fixture / URL changes what the page
// renders without code change."

export interface RoleFixture {
  id: string
  label: string
  groups: string[]
  description: string
}

export const ROLE_FIXTURES: Record<string, RoleFixture> = {
  ops_admin: {
    id: 'ops_admin',
    label: 'Ops Admin',
    groups: ['ops_admin'],
    description: 'All nav items visible; full ULDetailView access. All fields editable; "Approve"/"Reject" actions enabled.',
  },
  ops_viewer: {
    id: 'ops_viewer',
    label: 'Ops Viewer',
    groups: ['ops_viewer'],
    description: 'One nav item hidden (e.g. Settings); landing on ULDetailView allowed. Fields render view-only; "Approve"/"Reject" actions disabled.',
  },
}

export function resolveRoleFixture(role: string | null | undefined): RoleFixture | null {
  if (!role) return null
  return ROLE_FIXTURES[role] ?? null
}

// Role names known to the platform — used for dropdowns, documentation, etc.
export const ROLE_IDS = Object.keys(ROLE_FIXTURES)
