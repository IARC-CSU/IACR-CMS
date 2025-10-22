import path from 'path';
import { fileURLToPath } from 'url';

// Delegate to the scripts/export-all.js runner
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runner = path.join(__dirname, 'scripts', 'export-all.js');
// Simple delegation to the scripts/export-all.js
// This now includes automatic copying to Canviz locales directory
import('./scripts/export-all.js');