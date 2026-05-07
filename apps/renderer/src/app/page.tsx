import { redirect } from 'next/navigation'

const APP_SLUG = process.env['APP_SLUG']

export default function RootPage(): never {
  if (APP_SLUG) {
    redirect(`/${APP_SLUG}`)
  }
  redirect('/not-found')
}
