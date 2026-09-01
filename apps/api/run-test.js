const { spawn } = require('child_process');
const path = require('path');

const nodeModulesBin = path.join(__dirname, 'node_modules', '.bin');
const testFile = 'src/__tests__/student-enrollment-state.integration.test.ts';

console.log('Running enrollment state test...');

// Use npx to run vitest to handle path issues
const vitest = spawn('npx', ['vitest', 'run', testFile, '--no-coverage'], {
  stdio: 'inherit',
  cwd: __dirname
});

vitest.on('close', (code) => {
  console.log(`Test process exited with code ${code}`);
  process.exit(code);
});

vitest.on('error', (err) => {
  console.error('Failed to start test process:', err);
  process.exit(1);
});