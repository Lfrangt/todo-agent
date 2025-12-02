import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smarttodo.agent',
  appName: 'Smart Todo',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0a0f1e",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: "DARK",
      overlaysWebView: true
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#6366f1"
    }
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "Smart Todo",
    backgroundColor: "#0a0f1e"
  }
};

export default config;
