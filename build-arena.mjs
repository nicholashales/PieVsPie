import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fighters } from './roster.mjs';

function copy(source, destination = source) {
  const target = join('arena-assets', destination);
  mkdirSync(dirname(target), {recursive: true});
  copyFileSync(source, target);
}

copy('arena-preview.html', 'arena/index.html');
copy('arena.js', 'arena/arena.js');
copy('roster.mjs', 'arena/roster.mjs');
copy('images/other/original/Arena.png');
for (const {name} of fighters) {
  for (const pose of [1, 2, 3]) {
    const path = 'images/fighters/800h/' + name.replaceAll(' ', '-') + '-' + pose + '.png';
    if (existsSync(path)) copy(path);
    else console.warn('Missing artwork: ' + path);
  }
}
