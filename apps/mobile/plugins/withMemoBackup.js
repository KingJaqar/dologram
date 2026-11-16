const fs = require('node:fs/promises');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');
const { parseStringPromise, Builder } = require('xml2js');

const exclusions = [
  { domain: 'file', path: 'memos/' },
  { domain: 'sharedpref', path: 'SecureStore' },
];
function exclude(section) {
  section.exclude = section.exclude || [];
  for (const entry of exclusions) {
    if (!section.exclude.some((node) => node.$?.domain === entry.domain && node.$?.path === entry.path)) section.exclude.push({ $: entry });
  }
}
async function mergeRules(xmlDirectory, reference, modern) {
  if (reference === 'false') return reference;
  const name = reference?.startsWith('@xml/') ? reference.slice(5) : modern ? 'memo_data_extraction_rules' : 'memo_backup_rules';
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error('Memo backup rules require a local Android XML resource.');
  const file = path.join(xmlDirectory, `${name}.xml`);
  let document;
  try { document = await parseStringPromise(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (modern) {
    document = document || { 'data-extraction-rules': {} };
    const root = document['data-extraction-rules'];
    if (!root || typeof root !== 'object') throw new Error('Invalid data extraction rules');
    for (const kind of ['cloud-backup', 'device-transfer']) {
      if (!root[kind]?.length) root[kind] = [{}];
      for (const section of root[kind]) exclude(section);
    }
  } else {
    document = document || { 'full-backup-content': {} };
    if (typeof document['full-backup-content'] === 'string') document['full-backup-content'] = {};
    exclude(document['full-backup-content']);
  }
  await fs.mkdir(xmlDirectory, { recursive: true });
  await fs.writeFile(file, new Builder().buildObject(document));
  return `@xml/${name}`;
}
module.exports = (config) => withAndroidManifest(config, async (mod) => {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
  const xmlDirectory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
  application.$['android:fullBackupContent'] = await mergeRules(xmlDirectory, application.$['android:fullBackupContent'], false);
  application.$['android:dataExtractionRules'] = await mergeRules(xmlDirectory, application.$['android:dataExtractionRules'], true);
  return mod;
});
module.exports.mergeRules = mergeRules;
