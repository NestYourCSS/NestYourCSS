import { main } from '../src/cli.js';

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
