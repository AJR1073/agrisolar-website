const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

if (process.argv.slice(2).some(arg => arg !== '--production')) {
    throw new Error('Usage: node scripts/build-hosting.js [--production]');
}
const production = process.argv.includes('--production');

const projectRoot = path.resolve(__dirname, '..');
const outputName = production ? 'dist-production' : 'dist';
const outputDir = path.join(projectRoot, outputName);
const allowedDirectories = [
    'about',
    'admin',
    'contact',
    'css',
    'faq',
    'gallery',
    'images',
    'js',
    'privacy',
    'projects',
    'safety-equipment',
    'service-area',
    'services'
];
const allowedFiles = [
    '404.html',
    'about.html',
    'index.html',
    'favicon.svg',
    'favicon.png',
    'favicon.ico',
    'apple-touch-icon.png',
    'robots.txt',
    'sitemap.xml'
];

if (
    path.dirname(outputDir) !== projectRoot ||
    !['dist', 'dist-production'].includes(path.basename(outputDir))
) {
    throw new Error('Refusing to build outside the project dist directory.');
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const directory of allowedDirectories) {
    fs.cpSync(
        path.join(projectRoot, directory),
        path.join(outputDir, directory),
        { recursive: true }
    );
}

for (const file of allowedFiles) {
    fs.copyFileSync(
        path.join(projectRoot, file),
        path.join(outputDir, file)
    );
}

// Default builds remain development-only. Production is a separate artifact;
// admin, error and redirect pages remain noindex in both environments.
function preparePages(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            preparePages(filename);
        } else if (entry.name.endsWith('.html')) {
            const html = fs.readFileSync(filename, 'utf8');
            const relative = path.relative(outputDir, filename).split(path.sep).join('/');
            let prepared = html.replace(/\s*<meta\s+name="robots"[^>]*>/gi, '');
            if (!production || relative.startsWith('admin/') || ['404.html', 'about.html'].includes(relative)) {
                prepared = prepared.replace(/<head>/i,
                    '<head>\n    <meta name="robots" content="noindex, nofollow, noarchive">');
            }
            // Ensure repeat visitors receive this release's scripts and styles.
            prepared = prepared.replace(/(src|href)="(\/(?:js|css|admin\/js)\/[^"?]+\.(?:js|css))(?:\?[^"\s]*)?"/g,
                (match, attribute, asset) => {
                    const assetPath = path.join(outputDir, asset);
                    if (!fs.existsSync(assetPath)) throw new Error(`Missing asset: ${asset}`);
                    const hash = crypto.createHash('sha256').update(fs.readFileSync(assetPath)).digest('hex').slice(0, 12);
                    return `${attribute}="${asset}?v=${hash}"`;
                });
            fs.writeFileSync(filename, prepared);
        }
    }
}

preparePages(outputDir);

console.log(
    `Prepared ${production ? 'production' : 'development'} Hosting output in ${outputName}.`
);
