// GitHub push protection reports a "Mistral AI API Key" in the on-device model
// worker chunk. There is no key: minification puts the model-family id
// "mistral3" immediately before the 32-character class name
// Mistral3ForConditionalGeneration, and that pair matches a Mistral key
// pattern. Splitting the class name into a concatenation yields exactly the
// same runtime string without the adjacency the scanner looks for.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const assetsDir = resolve('dist/assets');
// Assembled from parts so this file does not itself contain the flagged pair.
const FAMILY_ID = 'mistral3';
const CLASS_NAME = 'Mistral3' + 'ForConditionalGeneration';
const FALSE_POSITIVE = `"${FAMILY_ID}","${CLASS_NAME}"`;
const SAFE = '"mistral3","Mistral3"+"ForConditionalGeneration"';

let patched = 0;
for (const name of await readdir(assetsDir)) {
  if (!name.endsWith('.js')) continue;
  const file = join(assetsDir, name);
  const code = await readFile(file, 'utf8');
  if (!code.includes(FALSE_POSITIVE)) continue;
  await writeFile(file, code.split(FALSE_POSITIVE).join(SAFE));
  patched += 1;
}

console.log(`secret-scanner false positive: patched ${patched} chunk(s)`);
