import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envFile = join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const token = process.env.NGROK_AUTHTOKEN?.trim();
const stopped = new AbortController();
const hide = (value) => String(value).replaceAll(token || '__no_token__', '[oculto]');
let agent,
  expo,
  temp,
  closed = false;
async function cleanup(code) {
  if (closed) return;
  closed = true;
  stopped.abort();
  expo?.kill('SIGINT');
  agent?.kill('SIGTERM');
  if (temp) await rm(temp, { recursive: true, force: true });
  process.exitCode = code;
}
async function binary() {
  if (process.env.NGROK_BIN) return process.env.NGROK_BIN;
  if (process.platform !== 'linux' || !['x64', 'arm64'].includes(process.arch))
    throw new Error('Defina NGROK_BIN com o caminho do agente Ngrok 3 para este sistema.');
  const tools = join(root, '.expo', 'tools');
  await mkdir(tools, { recursive: true });
  const file = join(tools, 'ngrok');
  if (existsSync(file)) return file;
  console.log('Baixando o agente Ngrok 3 oficial (somente na primeira execução)…');
  const arch = process.arch === 'x64' ? 'amd64' : 'arm64';
  const response = await fetch(
    `https://bin.ngrok.com/c/bNyj1mQVY4c/ngrok-v3-stable-linux-${arch}.tgz`,
    { signal: AbortSignal.any([stopped.signal, AbortSignal.timeout(45000)]) },
  );
  if (!response.ok) throw new Error(`Não foi possível baixar Ngrok: HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 80000000) throw new Error('Download Ngrok maior que o esperado.');
  const archive = join(temp, 'ngrok.tgz');
  await writeFile(archive, bytes);
  execFileSync('tar', ['-xzf', archive, '-C', temp, '--no-same-owner', 'ngrok']);
  const staged = join(tools, 'ngrok.download');
  await copyFile(join(temp, 'ngrok'), staged);
  await chmod(staged, 0o700);
  await rename(staged, file);
  return file;
}
async function port() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const selected = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(selected)));
    });
  });
}
async function tunnel(file, selected, config) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(
      () => fail(new Error('Ngrok não conectou em 40 segundos. Verifique a conexão e sua conta.')),
      40000,
    );
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };
    agent = spawn(file, ['http', String(selected), '--config', config], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    agent.once('error', fail);
    agent.once('exit', (code) => {
      if (!settled) fail(new Error(`Agente Ngrok encerrou (código ${code}).`));
      else void cleanup(code || 1);
    });
    for (const stream of [agent.stdout, agent.stderr]) {
      const lines = createInterface({ input: stream });
      lines.on('line', (line) => {
        let value;
        try {
          value = JSON.parse(line);
        } catch {
          console.error(hide(line));
          return;
        }
        if (value.lvl === 'eror' || value.lvl === 'error' || value.err) {
          console.error(hide(value.err ?? value.msg ?? 'Erro no Ngrok.'));
        }
        if (
          !settled &&
          typeof value.url === 'string' &&
          /started (tunnel|endpoint)/i.test(value.msg ?? '')
        ) {
          let url;
          try {
            url = new URL(value.url);
          } catch {
            return;
          }
          if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
            return;
          settled = true;
          clearTimeout(timeout);
          resolve(url.origin);
        }
      });
    }
  });
}
process.once('SIGINT', () => void cleanup(0));
process.once('SIGTERM', () => void cleanup(0));
try {
  if (!token)
    throw new Error(
      'Configure NGROK_AUTHTOKEN em apps/mobile/.env com o authtoken da SUA conta: https://dashboard.ngrok.com/get-started/your-authtoken. Não use EXPO_PUBLIC_ para esse token.',
    );
  temp = await mkdtemp(join(tmpdir(), 'solution-ngrok-'));
  await chmod(temp, 0o700);
  const target = process.env.EXPO_API_PROXY_TARGET ?? 'http://127.0.0.1:8080';
  const ready = await fetch(`${target.replace(/\/$/, '')}/api/v1/health/ready`, {
    signal: AbortSignal.any([stopped.signal, AbortSignal.timeout(4000)]),
  }).catch(() => null);
  if (!ready?.ok)
    throw new Error(
      'A API local não está pronta. Execute docker compose --profile app up -d antes de iniciar Expo.',
    );
  const file = await binary();
  const version = execFileSync(file, ['version'], { encoding: 'utf8' });
  if (!/^ngrok version 3\./m.test(version))
    throw new Error(
      'Use o agente Ngrok 3. O agente antigo de @expo/ngrok não é usado por este comando.',
    );
  const selected = await port();
  const config = join(temp, 'ngrok.yml');
  await writeFile(
    config,
    `version: 3\nagent:\n  authtoken: ${JSON.stringify(token)}\n  console_ui: false\n  log: stdout\n  log_format: json\n  web_addr: false\n  update_check: false\n`,
    { mode: 0o600 },
  );
  const url = await tunnel(file, selected, config);
  if (!closed) {
    console.log(
      `Túnel da sua conta conectado: ${url}\nApp e API usam esse mesmo endereço.\nNo Expo Go, abra o endereço seguro: ${url.replace(/^https:/, 'exps:')}.\nSe o QR code mostrar exp:// na porta 443, use esse endereço exps:// manualmente.`,
    );
    const env = { ...process.env, EXPO_PACKAGER_PROXY_URL: url };
    delete env.NGROK_AUTHTOKEN;
    expo = spawn(
      process.execPath,
      [
        join(root, 'node_modules', 'expo', 'bin', 'cli'),
        'start',
        '--go',
        '--port',
        String(selected),
        '--max-workers',
        '2',
      ],
      { cwd: root, env, stdio: 'inherit' },
    );
    expo.once('error', (error) => {
      console.error(hide(error.message));
      void cleanup(1);
    });
    expo.once('exit', (code) => void cleanup(code || 0));
  }
} catch (error) {
  if (!closed) console.error(hide(error.message));
  await cleanup(1);
}
