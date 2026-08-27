const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const pyCmd = isWindows ? 'python' : 'python3';

const targets = process.argv.slice(2);
const all = targets.length === 0;
const has = (t) => all || targets.includes(t);

function run(cmd, args, cwd = ROOT) {
  console.log(`\n==> ${cmd} ${args.join(' ')}` + (cwd !== ROOT ? `   (en ${path.relative(ROOT, cwd) || '.'})` : ''));
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWindows });
  if (r.status !== 0) {
    console.error(`\n[error] falló el comando: ${cmd} ${args.join(' ')}`);
    process.exit(r.status === null ? 1 : r.status);
  }
}

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// 1) .env
if (has('env')) {
  const envFile = path.join(ROOT, '.env');
  if (fs.existsSync(envFile)) {
    console.log('\n[env] .env ya existe, se reutiliza.');
  } else if (fs.existsSync(path.join(ROOT, '.env.example'))) {
    fs.copyFileSync(path.join(ROOT, '.env.example'), envFile);
    console.log('\n[env] Se creó .env desde .env.example');
    console.log('[env] EDÍTALO con tus credenciales reales antes de arrancar.');
  } else {
    console.log('\n[env] Aviso: no hay .env ni .env.example.');
  }
}

// 2) Backend (Python + FastAPI)
if (has('backend')) {
  const venvPy = path.join(ROOT, 'venv', isWindows ? 'Scripts\\python.exe' : 'bin/python');
  if (!fs.existsSync(venvPy)) {
    console.log('\n[backend] Creando entorno virtual venv ...');
    run(pyCmd, ['-m', 'venv', 'venv']);
  }
  console.log('\n[backend] Instalando requirements.txt ...');
  run(venvPy, ['-m', 'pip', 'install', '--upgrade', 'pip']);
  run(venvPy, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
}

// 3) Frontend y Mobile (React/Vite y Expo)
if (has('frontend')) run('npm', ['install'], path.join(ROOT, 'frontend'));
if (has('mobile')) run('npm', ['install'], path.join(ROOT, 'mobile'));

// 4) WhatsApp — Evolution API vía npm (sin Docker, para pruebas locales)
if (has('evolution')) {
  const evoDir = path.join(ROOT, 'evolution-api');
  if (!fs.existsSync(path.join(evoDir, 'package.json'))) {
    console.log('\n[evolution] Clonando Evolution API 2.2.3 ...');
    run('git', ['clone', '--depth', '1', '--branch', '2.2.3', 'https://github.com/EvolutionAPI/evolution-api.git', 'evolution-api']);
  } else {
    console.log('\n[evolution] evolution-api ya está clonado.');
  }

  const env = readEnv(path.join(ROOT, '.env'));
  const apiKey = env.EVOLUTION_API_KEY || 'bna-salud-evolution-key-2026';
  const dbUri = env.SUPABASE_DB_URI;
  const base = [
    'SERVER_TYPE=http',
    'SERVER_PORT=8080',
    'AUTHENTICATION_TYPE=apikey',
    `AUTHENTICATION_API_KEY=${apiKey}`,
  ];
  if (dbUri) {
    base.push(
      'DATABASE_ENABLED=true',
      'DATABASE_PROVIDER=postgresql',
      `DATABASE_CONNECTION_URI=${dbUri}`,
      'DATABASE_CONNECTION_CLIENT_NAME=evolution_api',
      'DATABASE_SAVE_DATA_INSTANCE=true',
      'DATABASE_SAVE_DATA_NEW_MESSAGE=false',
      'DATABASE_SAVE_MESSAGE_UPDATE=false',
      'DATABASE_SAVE_DATA_CONTACTS=false',
      'DATABASE_SAVE_DATA_CHATS=false',
      'DATABASE_SAVE_DATA_LABELS=false',
      'DATABASE_SAVE_DATA_HISTORIC=false',
    );
  } else {
    console.log('\n[evolution] AVISO: BnaSalud/.env no tiene SUPABASE_DB_URI.');
    console.log('[evolution] Evolution correrá SIN base de datos (la instancia no persistirá).');
    base.push('DATABASE_ENABLED=false');
  }
  base.push(
    'LOG_LEVEL=info',
    'LOG_BAILEYS=error',
    'CONFIG_SESSION_PHONE_CLIENT=BnaSalud',
    'CONFIG_SESSION_PHONE_NAME=Chrome',
  );

  fs.writeFileSync(path.join(evoDir, '.env'), base.join('\n') + '\n');
  console.log('\n[evolution] evolution-api/.env generado desde BnaSalud/.env');
  console.log('    (si quieres persistir chat/mensajes, pon los SAVE_DATA en true en evolution-api/.env)');

  console.log('\n[evolution] Instalando dependencias de evolution-api ...');
  run('npm', ['install'], evoDir);
}

console.log('\n------------------------------');
console.log('Listo. Ahora puedes arrancar cada parte:');
console.log('  Backend:    venv\\Scripts\\python -m uvicorn app.main:app --port 8000');
console.log('  Frontend:   npm --prefix frontend run dev   (http://localhost:5173)');
console.log('  Mobile:     npm --prefix mobile start');
console.log('  WhatsApp:   npm --prefix evolution-api run start:prod   (panel http://localhost:8080)');
console.log('------------------------------');