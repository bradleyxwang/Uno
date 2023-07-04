let fs = require('file-system');

fs.mkdir('src/generated', { recursive: true }, (err) => {
    if (err) throw err;
});
fs.copyFile('../shared/src/common.ts', 'src/generated/common.ts', (err) => {
    if (err) throw err;
});