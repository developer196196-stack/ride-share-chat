/**
 * Extends app.json. Android push notifications need the Firebase Android app's
 * google-services.json (Firebase console → Project settings → Your apps → Android,
 * package com.ridesharechats.mobile). It is added only when present, so builds keep
 * working before it is set up. On EAS it can also come from a file environment variable
 * named GOOGLE_SERVICES_JSON.
 */
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const local = path.join(__dirname, 'google-services.json');
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? './google-services.json' : undefined);
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
