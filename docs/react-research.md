# React decisions

Read on 16 October 2026 before implementation:

- Context Hub `react/react`, JavaScript guide, version **19.2.6**, revision 2, updated 29 May 2026: [maintainer document](https://github.com/andrewyng/context-hub/blob/main/content/react/docs/react/javascript/DOC.md). The `chub` CLI was not installed; the exact catalog document was read from its public raw URL. No CLI invocation is claimed.
- [React useReducer](https://react.dev/reference/react/useReducer)
- [React createRoot](https://react.dev/reference/react-dom/client/createRoot)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

The app pins matching `react` and `react-dom` 19.2.6 and mounts with `createRoot` from `react-dom/client`. A lazy reducer initializer reads and validates storage; it never writes during render. `transition` is pure, with timestamps and IDs supplied by actions. The session reducer groups the resulting workspace, persistence baseline, recovery state and status message.

Search results, tags, counts and selection are derived during render. No memoization has been added without a measured need. Effects only manage external subscriptions, unload protection, service worker registration and native dialog focus, with cleanup. Editable lists use stable domain IDs. The Markdown renderer uses positional keys only for static, noninteractive text blocks.

Persistence runs at the user action boundary so a destructive replacement can write once before accepting its state. Failed ordinary saves retain a clearly marked in-memory copy. Failed destructive writes leave the current workspace untouched.
