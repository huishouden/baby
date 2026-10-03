import { initApp } from '@huishouden/pwa-kit/app';

// From VITE_FIREBASE_* build variables: CI sets them from repo variables; locally `bun run env:pull`.
// Auth kept in IndexedDB, observability, Google API tokens, and Firestore's persistent cache: the log
// opens and accepts entries offline, and the kit's outbox writes an entry logged just before the app
// is closed when it next opens.
export const { app, auth, db, googleClientId, signInWithGoogle, signOutEverywhere } = initApp({ app: 'baby', env: import.meta.env });
