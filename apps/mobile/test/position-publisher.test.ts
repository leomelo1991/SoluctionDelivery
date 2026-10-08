import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPositionPublisher,
  type PositionSample,
} from '../../../packages/contracts/src/position-publisher';
const sample = { latitude: -20.5, longitude: -47.4, accuracy: 10, observedAt: 100000 };
test('GPS publisher drops invalid, stale and replayed samples, with one request at a time', async () => {
  let finish!: () => void;
  let clock = 100000;
  const sent: PositionSample[] = [];
  const statuses: string[] = [];
  const publisher = createPositionPublisher(
    async (p) => {
      sent.push(p);
      await new Promise<void>((r) => {
        finish = r;
      });
      return { accepted: true };
    },
    (s) => statuses.push(s),
    () => clock,
  );
  publisher.push({ ...sample, latitude: 100 });
  await publisher.flush();
  assert.equal(sent.length, 0);
  publisher.push(sample);
  const first = publisher.flush();
  publisher.push({ ...sample, observedAt: 100001 });
  await publisher.flush();
  assert.equal(sent.length, 1);
  finish();
  await first;
  const second = publisher.flush();
  finish();
  await second;
  assert.equal(sent.length, 2);
  publisher.push({ ...sample, latitude: 1 });
  await publisher.flush();
  assert.equal(sent.length, 2);
  clock = 200000;
  publisher.push({ ...sample, observedAt: 100002 });
  await publisher.flush();
  assert.equal(sent.length, 2);
  publisher.push({ ...sample, observedAt: clock });
  const third = publisher.flush();
  publisher.stop();
  finish();
  await third;
  await publisher.flush();
  assert.equal(sent.length, 3);
  assert.equal(statuses.length, 2);
});
test('GPS publisher retries network failure with the newest sample', async () => {
  let fail = true;
  const sent: PositionSample[] = [];
  const p = createPositionPublisher(
    async (s) => {
      sent.push(s);
      if (fail) throw new Error('offline');
      return { accepted: true };
    },
    () => {},
    () => 100002,
  );
  p.push(sample);
  await p.flush();
  fail = false;
  p.push({ ...sample, observedAt: 100001 });
  await p.flush();
  await p.flush();
  assert.deepEqual(
    sent.map((s) => s.observedAt),
    [100000, 100001],
  );
});
