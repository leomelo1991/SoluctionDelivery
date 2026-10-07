import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'Solution Entregador',
  slug: 'solution-entregador',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  scheme: 'solution-entregador',
  extra: { allowHttp: process.env.APP_VARIANT === 'development' },
  ios: { supportsTablet: false, bundleIdentifier: 'com.solutiondelivery.courier' },
  android: { package: 'com.solutiondelivery.courier' },
  plugins: [
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Permita usar sua localização para mostrar sua moto no mapa enquanto o app estiver aberto.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    ...(process.env.GOOGLE_MAPS_ANDROID_KEY
      ? [
          [
            'react-native-maps',
            { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY },
          ] as [string, Record<string, string>],
        ]
      : []),
    [
      'expo-build-properties',
      { android: { usesCleartextTraffic: process.env.APP_VARIANT === 'development' } },
    ],
  ],
};
export default config;
