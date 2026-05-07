import type React from 'react'
import {
  Stack,
  Grid,
  Divider,
  Card,
  Tabs,
  Accordion,
  Modal,
  Button,
  IconButton,
  Link,
  DropdownMenu,
  Alert,
  Spinner,
  Skeleton,
  EmptyState,
  ErrorBoundary,
  Heading,
  Text,
  RichText,
  Badge,
  Avatar,
  Tag,
  StatCard,
  DataTable,
  Chart,
  TextInput,
  NumberInput,
  Select,
  MultiSelect,
  DatePicker,
  Checkbox,
  Toggle,
  RadioGroup,
  Textarea,
  FileUpload,
} from '@portal/ui'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PRIMITIVES: Record<string, React.ComponentType<any>> = {
  Stack,
  Grid,
  Divider,
  Card,
  Tabs,
  Accordion,
  Modal,
  Button,
  IconButton,
  Link,
  DropdownMenu,
  Alert,
  Spinner,
  Skeleton,
  EmptyState,
  ErrorBoundary,
  Heading,
  Text,
  RichText,
  Badge,
  Avatar,
  Tag,
  StatCard,
  DataTable,
  Chart,
  TextInput,
  NumberInput,
  Select,
  MultiSelect,
  DatePicker,
  Checkbox,
  Toggle,
  RadioGroup,
  Textarea,
  FileUpload,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerPrimitives(map: Record<string, React.ComponentType<any>>): void {
  Object.assign(PRIMITIVES, map)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolvePrimitive(type: string): React.ComponentType<any> | null {
  return PRIMITIVES[type] ?? null
}
