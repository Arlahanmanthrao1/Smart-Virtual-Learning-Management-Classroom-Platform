// Non-browser route and server-rendering checks. No accounts or API calls.
const { build } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');

(async () => {
  const result = await build({
    entryPoints: [path.join(__dirname, 'dashboard-pages.jsx')], bundle: true,
    write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const test = new Module(path.join(__dirname, 'dashboard-pages.generated.cjs'), module);
  test.filename = path.join(__dirname, 'dashboard-pages.generated.cjs');
  test.paths = module.paths;
  test._compile(result.outputFiles[0].text, test.filename);
})().catch(error => { console.error(error); process.exitCode = 1; });
