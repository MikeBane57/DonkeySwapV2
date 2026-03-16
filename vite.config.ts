import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

/** Writes build/version.json during production build (for deploy verification on live site). */
function deployVersionPlugin() {
    return {
        name: 'deploy-version',
        closeBundle() {
            const outDir = path.resolve(__dirname, 'public/build');
            if (!fs.existsSync(outDir)) return;
            let commit = '';
            try {
                commit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
            } catch {
                commit = 'unknown';
            }
            const version = {
                commit,
                date: new Date().toISOString(),
                // Prefer a CI-provided app version (e.g. 2.1.123); fallback to commit hash.
                version: process.env.VITE_APP_VERSION ?? commit,
            };
            fs.writeFileSync(
                path.join(outDir, 'version.json'),
                JSON.stringify(version, null, 0),
            );
        },
    };
}

export default defineConfig({
    server: {
        host: true,
        port: 5173,
        cors: true,
        hmr: {
            host: process.env.VITE_DEV_SERVER_HOST ?? 'localhost',
            port: 5173,
        },
    },
    plugins: [
        deployVersionPlugin(),
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ],
    esbuild: {
        jsx: 'automatic',
    },
});
