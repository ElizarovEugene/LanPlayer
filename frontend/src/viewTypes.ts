import type { TranslationKey } from './i18n/translations'

export type View =
  | { kind: 'songs' }
  | { kind: 'albums' }
  | { kind: 'album'; album: string; albumArtist: string }
  | { kind: 'artists' }
  | { kind: 'artist'; name: string }
  | { kind: 'recent' }
  | { kind: 'liked' }
  | { kind: 'playlist'; id: number; name: string; smart?: boolean }
  | { kind: 'radio' }

export function viewTitle(view: View, t: (key: TranslationKey) => string): string {
  switch (view.kind) {
    case 'songs': return t('view.songs')
    case 'albums': return t('view.albums')
    case 'album': return view.album
    case 'artists': return t('view.artists')
    case 'artist': return view.name
    case 'recent': return t('view.recent')
    case 'liked': return t('view.liked')
    case 'playlist': return view.name
    case 'radio': return t('view.radio')
  }
}
