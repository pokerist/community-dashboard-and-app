const {
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function withCleartextHttpAndroidManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults?.manifest;
    if (!manifest) return mod;

    const app = manifest.application?.[0];
    if (!app) return mod;

    app.$ = app.$ || {};
    app.$['android:usesCleartextTraffic'] = 'true';
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';

    return mod;
  });
}

function withCleartextHttpNetworkSecurityConfig(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const projectRoot = mod.modRequest.platformProjectRoot;
      const xmlDir = path.join(projectRoot, 'app', 'src', 'main', 'res', 'xml');
      const xmlPath = path.join(xmlDir, 'network_security_config.xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        xmlPath,
        `<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n  <base-config cleartextTrafficPermitted="true" />\n</network-security-config>\n`,
        'utf8',
      );
      return mod;
    },
  ]);
}

module.exports = function withCleartextHttp(config) {
  config = withCleartextHttpAndroidManifest(config);
  config = withCleartextHttpNetworkSecurityConfig(config);
  return config;
};

