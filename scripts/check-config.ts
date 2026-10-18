import { storeConfig, publicStoreConfig } from '../apps/api/src/config.js';

console.log(`PASS store JSON schema and cross-field validation (${storeConfig.storeId}, ${storeConfig.revision})`);
const publicJson = JSON.stringify(publicStoreConfig());
if (/DATABASE_URL|SECRET|PASSWORD|maximumByCurrency|rateBasisPoints|demoAdmin/.test(publicJson)) throw new Error('Private configuration leaked');
console.log('PASS public configuration allowlist');
