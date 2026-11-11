const { existsSync } = require('node:fs');
const { join } = require('node:path');

module.exports = ({ config, projectRoot }) => {
  const localFile = join(projectRoot, 'google-services.json');
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (existsSync(localFile) ? localFile : undefined);
  if (!googleServicesFile) return config;
  return { ...config, android: { ...config.android, googleServicesFile } };
};
