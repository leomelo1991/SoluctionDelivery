import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
export function useForeground() {
  const [active, setActive] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => listener.remove();
  }, []);
  return active;
}
