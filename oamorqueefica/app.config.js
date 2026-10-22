// Complementa o app.json. O push enviado pelo servidor (Expo Push) só chega ao
// Android com o google-services.json do Firebase. Quando o arquivo estiver na
// pasta do app, ele entra no build automaticamente.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const arquivo = path.join(__dirname, 'google-services.json');
  if (!fs.existsSync(arquivo)) return config;
  return { ...config, android: { ...config.android, googleServicesFile: './google-services.json' } };
};
