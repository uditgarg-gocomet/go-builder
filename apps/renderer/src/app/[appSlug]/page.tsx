import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ appSlug: string }>
}

export default async function AppHomePage({ params }: PageProps): Promise<never> {
  const { appSlug } = await params
  // Redirect to the first page — will be replaced by schema-driven routing in Session 6.2
  redirect(`/${appSlug}/home`)
}
