import { Component, type PropsWithChildren } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, Button, Copy, ErrorNotice, Screen } from './components/ui';
import { resolveApiUrl } from './core/api-url';
import { SessionProvider, useSession } from './core/session';
import { DataProvider } from './core/queries';
import { Access, FirstPassword } from './screens/Access';
import { CourierHome } from './screens/Courier';
class Boundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Screen>
        <Copy title>Não foi possível abrir esta tela.</Copy>
        <Button title="Tentar novamente" onPress={() => this.setState({ failed: false })} />
      </Screen>
    ) : (
      this.props.children
    );
  }
}
function Routes() {
  const { user } = useSession();
  return !user ? (
    <Access />
  ) : user.mustChangePassword ? (
    <FirstPassword />
  ) : (
    <DataProvider key={`${user.tenantId}:${user.id}`}>
      <CourierHome />
    </DataProvider>
  );
}
export default function App() {
  let url: string;
  try {
    url = resolveApiUrl({
      configured: process.env.EXPO_PUBLIC_API_URL,
      hostUri: Constants.expoConfig?.hostUri,
      development: __DEV__,
      expoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
      tunnel: Constants.expoGoConfig?.packagerOpts?.hostType === 'tunnel',
      allowHttp: __DEV__ || Constants.expoConfig?.extra?.allowHttp === true,
    });
  } catch (e) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <SafeAreaView style={{ flex: 1 }}>
            <Screen>
              <ErrorNotice message={(e as Error).message} />
            </Screen>
          </SafeAreaView>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar style="auto" />
          <Boundary>
            <SessionProvider url={url}>
              <Routes />
            </SessionProvider>
          </Boundary>
        </SafeAreaView>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
