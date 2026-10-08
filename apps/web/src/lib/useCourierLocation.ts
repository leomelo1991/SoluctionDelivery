import { useEffect, useState } from 'react';
import { createPositionPublisher } from '@solution/contracts';
import { api } from './api';
export function useCourierLocation(enabled: boolean) {
  const [status, setStatus] = useState('Localização não compartilhada.');
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let reading = false;
    const publisher = createPositionPublisher(
      (sample) => api('/operations-map/location', 'POST', sample),
      (result) =>
        setStatus(
          result === 'sent'
            ? 'GPS compartilhado com a operação enquanto esta tela está visível.'
            : 'Falha ao compartilhar o GPS. Tentando novamente…',
        ),
    );
    setStatus('Permita o GPS para aparecer no mapa da operação.');
    const tick = () => {
      if (stopped || document.hidden || reading) return;
      if (!navigator.geolocation) {
        setStatus('GPS indisponível neste navegador.');
        return;
      }
      reading = true;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          reading = false;
          if (stopped || document.hidden) return;
          publisher.push({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            observedAt: position.timestamp,
          });
          void publisher.flush();
        },
        (error) => {
          reading = false;
          if (!stopped)
            setStatus(
              error.code === 1
                ? 'Permita o GPS nas configurações do navegador para aparecer no mapa.'
                : 'Sem sinal de GPS recente. Verifique a localização do aparelho.',
            );
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
      );
    };
    tick();
    const timer = setInterval(tick, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
      publisher.stop();
    };
  }, [enabled]);
  return enabled ? status : 'Localização não compartilhada enquanto indisponível.';
}
