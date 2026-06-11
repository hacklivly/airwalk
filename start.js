import { spawn } from 'child_process';

console.log('✈️  Airwalk launcher: Starting Astro development server and WebSocket signaling server...');

// Spawn signaling server
const signaling = spawn('node', ['signaling.js'], { 
  stdio: 'inherit', 
  shell: true 
});

// Spawn Astro dev server
const astro = spawn('npx', ['astro', 'dev'], { 
  stdio: 'inherit', 
  shell: true 
});

// Handle graceful shutdown on Ctrl+C or process exit
const cleanup = () => {
  console.log('\n🛑 Airwalk launcher: Stopping services...');
  try {
    signaling.kill('SIGINT');
  } catch (e) {}
  try {
    astro.kill('SIGINT');
  } catch (e) {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
