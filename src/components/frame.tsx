import type { User } from 'firebase/auth';
import { AppOpening, type AppFrameProps, type OpeningPhase } from '@huishouden/pwa-kit/react/frame';
import type { Tab } from '@huishouden/pwa-kit/react/ui';
import { PORTAL_URL } from '../lib/portal';
import { useT } from '../i18n';

/** Who is signed in and the app bar's sign-in controls. `user` is undefined while the session restores. */
export interface Account {
  user: User | null | undefined;
  signingIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const VERSION = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_BUILD_SHA})`;

/**
 * Baby's frame (the kit's `AppFrame`): the same props while the app opens and once it has loaded, so
 * nothing moves between them. Without `tabs`, no tabs: while opening (they depend on the person's
 * role and on whether the baby is born) and on a note outside the app's sections.
 */
export function babyFrame(t: ReturnType<typeof useT>, account: Account, tabs?: { tabs: Tab[]; id: string; choose: (id: string) => void }): AppFrameProps {
  return {
    app: t('app.name'),
    glyph: 'bottle',
    portalUrl: PORTAL_URL,
    version: VERSION,
    ...account,
    layout: 'fit',
    ...(tabs && { tabs: tabs.tabs, tab: tabs.id, onTab: tabs.choose }),
  };
}

/** The app while it opens: the kit's opening frame, without tabs until the household says which. */
export function BabyOpening({ phase, ...account }: Account & { phase: OpeningPhase }) {
  const t = useT();
  return <AppOpening {...babyFrame(t, account)} phase={phase} />;
}
