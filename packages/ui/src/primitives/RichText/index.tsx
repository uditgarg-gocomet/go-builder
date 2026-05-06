import React from 'react'
import { z } from 'zod'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { cn } from '../../lib/utils.js'

export const RichTextPropsSchema = z.object({
  content: z.string().default(''),
  editable: z.boolean().default(false),
  className: z.string().optional(),
})

export type RichTextProps = z.infer<typeof RichTextPropsSchema> & {
  onChange?: (html: string) => void
  style?: React.CSSProperties
}

export const richTextManifest = {
  displayName: 'Rich Text',
  category: 'Typography',
  description: 'TipTap-powered rich text viewer (read-only in Renderer, editable in Builder)',
  icon: 'file-text',
  tags: ['rich-text', 'typography', 'editor', 'tiptap'],
}

export function RichText({ content = '', editable = false, onChange, className, style }: RichTextProps): React.ReactElement {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getHTML())
    },
  })

  return (
    <div style={style} className={cn('prose prose-sm max-w-none', className)}>
      <EditorContent editor={editor} />
    </div>
  )
}
