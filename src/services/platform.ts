import { Capacitor } from '@capacitor/core';

/** True inside the Capacitor Android/iOS shell, false in a browser. */
export const isNativeApp = Capacitor.isNativePlatform();
