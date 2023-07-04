import { mkdir, copyFile } from 'file-system';

mkdir('src/generated', { recursive: true }, (err) => {
    if (err) throw err;
});
copyFile('../shared/src/common.ts', 'src/generated/common.ts', (err) => {
    if (err) throw err;
});