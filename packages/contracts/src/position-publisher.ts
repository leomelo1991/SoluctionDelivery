export interface PositionSample {
  latitude: number;
  longitude: number;
  accuracy: number;
  observedAt: number;
}
/** Uma amostra por envio, sem fila de posições antigas nem requisições sobrepostas. */
export function createPositionPublisher(
  send: (sample: PositionSample) => Promise<{ accepted: boolean }>,
  onStatus: (status: 'sent' | 'error') => void,
  now = Date.now,
) {
  let latest: PositionSample | undefined;
  let sentAt = -1;
  let pending = false;
  let stopped = false;
  return {
    push(sample: PositionSample) {
      if (
        !Number.isFinite(sample.latitude) ||
        Math.abs(sample.latitude) > 90 ||
        !Number.isFinite(sample.longitude) ||
        Math.abs(sample.longitude) > 180 ||
        !Number.isFinite(sample.accuracy) ||
        sample.accuracy < 0 ||
        sample.accuracy > 10000 ||
        !Number.isSafeInteger(sample.observedAt) ||
        sample.observedAt > now() + 5000
      )
        return;
      if (!latest || sample.observedAt > latest.observedAt) latest = sample;
    },
    async flush() {
      if (
        stopped ||
        pending ||
        !latest ||
        latest.observedAt <= sentAt ||
        latest.observedAt < now() - 30000
      )
        return;
      const sample = latest;
      pending = true;
      try {
        const result = await send(sample);
        sentAt = sample.observedAt;
        if (!stopped) onStatus(result.accepted ? 'sent' : 'error');
      } catch {
        if (!stopped) onStatus('error');
      } finally {
        pending = false;
      }
    },
    stop() {
      stopped = true;
      latest = undefined;
    },
  };
}
