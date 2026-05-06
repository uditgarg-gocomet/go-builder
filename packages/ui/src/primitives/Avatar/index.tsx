import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const AvatarPropsSchema = z.object({
  src: z.string().optional(),
  alt: z.string().default(''),
  fallback: z.string().default(''),
  size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).default('md'),
  className: z.string().optional(),
})

export type AvatarProps = z.infer<typeof AvatarPropsSchema> & { style?: React.CSSProperties }

export const avatarManifest = {
  displayName: 'Avatar',
  category: 'Data',
  description: 'User avatar image with fallback initials',
  icon: 'user-circle',
  tags: ['avatar', 'user', 'profile', 'image'],
}

const sizeMap = { xs: 'h-6 w-6 text-xs', sm: 'h-8 w-8 text-sm', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-lg' }

export function Avatar({ src, alt = '', fallback = '', size = 'md', className, style }: AvatarProps): React.ReactElement {
  const [imgError, setImgError] = React.useState(false)
  const initials = fallback || alt.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div
      style={style}
      className={cn('relative flex items-center justify-center rounded-full bg-muted overflow-hidden select-none shrink-0', sizeMap[size], className)}
    >
      {src && !imgError ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setImgError(true)} />
      ) : (
        <span className="font-medium text-muted-foreground">{initials}</span>
      )}
    </div>
  )
}
