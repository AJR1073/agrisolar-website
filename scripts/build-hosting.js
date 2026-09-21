const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'dist');
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
    path.basename(outputDir) !== 'dist'
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

// This build targets Firebase development Hosting only. Keep a page-level
// noindex fallback alongside the Hosting header without changing source SEO.
function protectDevelopmentPages(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            protectDevelopmentPages(filename);
        } else if (entry.name.endsWith('.html')) {
            const html = fs.readFileSync(filename, 'utf8');
            const withoutRobots = html.replace(/\s*<meta\s+name="robots"[^>]*>/gi, '');
            fs.writeFileSync(filename, withoutRobots.replace(
                /<head>/i,
                '<head>\n    <meta name="robots" content="noindex, nofollow, noarchive">'
            ));
        }
    }
}

protectDevelopmentPages(outputDir);

console.log(
    `Prepared Firebase Hosting output with ${allowedDirectories.length} directories and ${allowedFiles.length} root files.`
);
