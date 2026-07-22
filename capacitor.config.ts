import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Frontline iOS shell.
 *
 * appId (bundle identifier): PROPOSED value below — Team ID LMNGCLUC3S is
 * reused from Happy Hour Live, but the bundle ID CANNOT be nyc.happyhour.app
 * again. This ID is NOT yet registered on the Apple Developer portal.
 * See DECISIONS.md → "iOS bundle identifier" (awaiting approval before
 * registration / provisioning).
 */
const config: CapacitorConfig = {
  appId: 'app.frontline.intel',
  appName: 'Frontline',
  webDir: 'out',
  server: {
    // In production the shell loads the deployed web app; during local dev
    // point this at the Next dev server for live reload.
    // url: 'http://localhost:3000',
    // cleartext: true,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
