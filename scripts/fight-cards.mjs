import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import QRCode from 'qrcode';
import { fighters } from '../roster.mjs';
import { registeredCode } from '../battle.js';

const roster = new Map(fighters.map(fighter => [fighter.id, fighter.name]));
const sqlText = value => "'" + value.replaceAll("'", "''") + "'";
const htmlText = value => value.replace(/[&<>"']/g, char => (
  {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]
));

export function validateFights(manifest) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.fights) || !manifest.fights.length) {
    throw new Error('Expected version 1 with a nonempty fights array');
  }
  const codes = new Set();
  return manifest.fights.map(({code, redId, whiteId} = {}, index) => {
    const red = roster.get(redId);
    const white = roster.get(whiteId);
    if (!registeredCode(code)) throw new Error('Fight ' + (index + 1) + ' has an invalid or reserved code');
    if (codes.has(code.toUpperCase())) throw new Error('Duplicate fight code: ' + code);
    if (!red || !white || red === white) throw new Error('Unknown or identical roster IDs for ' + code);
    codes.add(code.toUpperCase());
    return {code, red, white};
  });
}

export function registerSQL(fights) {
  const values = fights.map(({code, red, white}) => '(' + [code, red, white].map(sqlText).join(',') + ')').join(',\n');
  // One statement. The fixed-pair trigger rejects the entire import on a mismatched existing code.
  return `INSERT INTO registered_fights(fight_code,red_fighter,white_fighter)
VALUES ${values}
ON CONFLICT DO UPDATE SET fight_code=excluded.fight_code,red_fighter=excluded.red_fighter,white_fighter=excluded.white_fighter
WHERE registered_fights.fight_code<>excluded.fight_code OR registered_fights.red_fighter<>excluded.red_fighter
   OR registered_fights.white_fighter<>excluded.white_fighter;
`;
}

export async function printCards(fights) {
  const cards = [];
  for (const {code, red, white} of fights) {
    const url = 'https://pievspie.online/arena/?code=' + encodeURIComponent(code);
    const qr = await QRCode.toString(url, {type: 'svg', margin: 4, errorCorrectionLevel: 'M'});
    cards.push('<article><h2>Fight ' + htmlText(code) + '</h2><p><b>Red</b> ' + htmlText(red) +
      '<br><b>White</b> ' + htmlText(white) + '</p><a href="' + htmlText(url) +
      '" aria-label="Open fight ' + htmlText(code) + '">' + qr + '</a><p>Scan to vote, or enter the fight code at pievspie.online.</p></article>');
  }
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pie vs Pie fight cards</title><style>
body{font:16px/1.4 Arial,sans-serif;margin:1em;color:#1a1a2e}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
article{border:1px solid;padding:.6em;text-align:center;break-inside:avoid}h2{margin:.25em;color:#a00000}svg{width:44mm;height:44mm}
@media print{main{display:block}article{display:inline-block;width:43%;margin:1mm;vertical-align:top}}
</style><h1>PIE VS PIE — FIGHT CARDS</h1><main>${cards.join('')}</main></html>\n`;
}

async function main([manifestPath, outputDirectory, ...extra]) {
  if (!manifestPath || !outputDirectory || extra.length) {
    throw new Error('Usage: npm run fight-cards -- manifest.json new-output-directory');
  }
  const fights = validateFights(JSON.parse(await readFile(manifestPath, 'utf8')));
  const html = await printCards(fights);
  await mkdir(outputDirectory);
  await writeFile(join(outputDirectory, 'register.sql'), registerSQL(fights), {flag: 'wx'});
  await writeFile(join(outputDirectory, 'fight-cards.html'), html, {flag: 'wx'});
  console.log('Generated ' + fights.length + ' fight cards and registration SQL in ' + outputDirectory);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
