import {mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const names=["Alan Star","Billie Pieper","Brandy Toksvig","C3-Pie0","Camilla Mixing-Bowls","Crustia Winkleman","Crustin Hoffman","Crusty Springfield","Dave Grohlling Pin","Dr Choux","Greggs Davies","Icing Charles","Jasmin Pieris","Kevin Pietersen","Linford Crusty","Luke Piewalker","Miley Pyrus","Mince Pyson","Mr Feast","Oscar Pastry","Piela Radcliffe","Pieman Cowell","Pieter Schmeichel","Princess Pieanna","R2-D-Licious","Shortcrustney Dauwalter","Stephen Pie","The Sultana of Brunei"];
function copy(src,dst=src){const target=join('arena-assets',dst);mkdirSync(target.substring(0,target.lastIndexOf('/')),{recursive:true});copyFileSync(src,target)}
copy('arena-preview.html','arena/index.html');
copy('images/other/original/Arena.png');
for(const n of names)for(const pose of [1,2,3]){const path='images/fighters/800h/'+n.replaceAll(' ','-')+'-'+pose+'.png';if(existsSync(path))copy(path);else console.warn('Missing artwork: '+path)}
