import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type MdNode = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  label?: string
  value?: string
  type?: string
  selected?: boolean
  disabled?: boolean
  supportingText?: string
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-outlined-text-field': MdNode
      'md-filled-button': MdNode
      'md-text-button': MdNode
      'md-outlined-segmented-button-set': MdNode
      'md-outlined-segmented-button': MdNode
    }
  }
}
