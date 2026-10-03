import { spawn } from 'child_process';

console.log('🚀 Démarrage de BIZBOOSTER Gabon :');
console.log('   ➜ Frontend Client : http://localhost:3000/');
console.log('   ➜ Back-Office Admin (Portail Unifié) : http://localhost:3000/admin');
console.log('   ➜ Back-Office Admin (Serveur Dédié)  : http://localhost:3001/');

const frontend = spawn('npx', ['vite', '--port=3000', '--host=0.0.0.0'], {
  stdio: 'inherit',
  shell: true,
});

const admin = spawn('npm', ['--prefix', 'admin', 'run', 'dev'], {
  stdio: 'inherit',
  shell: true,
});

const cleanup = (code = 0) => {
  try {
    frontend.kill();
  } catch (e) {}
  try {
    admin.kill();
  } catch (e) {}
  process.exit(code);
};

frontend.on('exit', (code) => {
  if (code !== 0) console.error('Processus Frontend arrêté avec le code :', code);
});

admin.on('exit', (code) => {
  if (code !== 0) console.error('Processus Admin arrêté avec le code :', code);
});

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));
process.on('exit', () => cleanup(0));
