// Hand-authored ESM so this plugin needs no build step. The www/ app talks to
// the bridge through www/bridge.js (which uses the global Capacitor runtime),
// so this file exists mainly to give the package a valid entry point and to
// make the plugin importable from a bundled host app.
import { registerPlugin } from '@capacitor/core';

export const AppUsage = registerPlugin('AppUsage');
export default AppUsage;
