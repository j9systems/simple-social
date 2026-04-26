# Tab Bar Reference (for rebuild)

## Tabs
| Label    | Route     | Icon                         |
|----------|-----------|------------------------------|
| Home     | `/`       | House SVG                    |
| Search   | `/search` | Magnifying glass SVG         |
| Upload   | `/upload` | Plus/cross SVG               |
| Profile  | `/profile`| User's avatar (from profile) |

## SVG Icons

### Home
```svg
<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5v-9Z" /></svg>
```

### Search
```svg
<svg viewBox="0 0 24 24"><path d="M11 4a7 7 0 1 0 4.4 12.5l4 4 1.4-1.4-4-4A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" /></svg>
```

### Upload
```svg
<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" /></svg>
```

### Profile
Uses `<img>` with the viewer's avatar URL (from `buildAvatarSrc()`).

## Behaviors
- Tapping the active Home tab scrolls the feed to top (dispatches `HOME_TAB_RESELECT_EVENT`)
- Tab navigation uses `onPointerDown` / `onTouchStart` for instant feel (calls `router.push()`)
- Soft keyboard is dismissed on tab switch (`dismissSoftKeyboard()`)
- All tabs are prefetched on mount (`router.prefetch()`)
- Active tab icon uses `--tab-active-icon` color (#5f259f light / #b995ff dark)
- Profile tab shows the viewer's avatar with a circular border

## Design Tokens (CSS variables)
- `--tabbar-bg`: #ffffff (light) / #1b1d1f (dark)
- `--tab-active-icon`: #5f259f (light) / #b995ff (dark)
- `--line`: border color
- `--muted`: inactive icon/label color
