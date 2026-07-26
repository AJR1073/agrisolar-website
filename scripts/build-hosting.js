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
    'service-area',
    'services'
];
const allowedFiles = [
    '404.html',
    'about.html',
    'index.html',
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

console.log(
    `Prepared Firebase Hosting output with ${allowedDirectories.length} directories and ${allowedFiles.length} root files.`
);
