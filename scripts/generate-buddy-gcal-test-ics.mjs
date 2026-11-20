/* eslint-env node */
/**
 * Writes public/samples/*.ics for the Feb 2027 GCal import smoke test.
 * Run after changing buddy-bid-google-calendar or smoke fixture: npm run gcal:test-samples
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

async function loadExportModule() {
    const server = await createServer({
        root,
        configFile: join(root, 'vite.config.ts'),
        logLevel: 'error',
    });
    await server.pluginContainer.buildStart({});
    const mod = await server.ssrLoadModule(
        '/resources/js/pages/app/bid-tools/buddy-bids/buddy-bid-gcal-smoke-test-export.ts',
    );
    await server.close();
    return mod;
}

async function main() {
    const { buildBuddyBidGcalSmokeTestIcs } = await loadExportModule();
    const outDir = join(root, 'public', 'samples');
    await mkdir(outDir, { recursive: true });

    for (const [slot, filename] of [
        [1, 'buddy-bid-gcal-test-feb2027-smoke-am.ics'],
        [2, 'buddy-bid-gcal-test-feb2027-smoke-pm.ics'],
    ]) {
        const ics = buildBuddyBidGcalSmokeTestIcs(slot);
        if (!ics) {
            throw new Error(`No ICS generated for smoke buddy ${slot}`);
        }
        const events = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
        await writeFile(join(outDir, filename), ics, 'utf8');
        console.log(`Wrote ${filename} (${events} events)`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});