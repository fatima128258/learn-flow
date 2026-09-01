const { default: EmbeddedPostgres } = require('embedded-postgres');
const path = require('path');

const pg = new EmbeddedPostgres({
  database_dir: path.join(__dirname, '.pgdata'),
  user: 'learnflow',
  password: 'learnflow_pass',
  database: 'learnflow_db',
  port: 5432,
  logs_enabled: false,
});

async function main() {
  try {
    console.log('Initializing PostgreSQL...');
    await pg.initialise();
    console.log('Starting PostgreSQL...');
    await pg.start();
    console.log('PostgreSQL started on port 5432');
    
    const connectionString = pg.getConnectionUri();
    console.log('Connection URI:', connectionString);
    
    // Keep process alive
    console.log('PostgreSQL is running. Press Ctrl+C to stop.');
    process.on('SIGINT', async () => {
      console.log('Stopping PostgreSQL...');
      await pg.stop();
      process.exit(0);
    });
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
