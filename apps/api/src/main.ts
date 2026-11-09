import { Logger } from '@nestjs/common';
import { loadConfig } from './config.js';
import { createApp } from './bootstrap.js';

const config = loadConfig();
const app = await createApp();
await app.listen(config.PORT, '0.0.0.0');
new Logger('Bootstrap').log(`NextStep API listening on :${config.PORT} (${config.NODE_ENV}). Docs at /docs`);
