import { createApp } from './app';
import { config } from './config';
import { startScheduler } from './services/schedulerService';

const app = createApp();

app.listen(config.port, () => {
  console.log(`[credit-incentive] listening on http://localhost:${config.port}`);
});

startScheduler();

export { app };
