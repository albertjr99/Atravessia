const fs = require('fs');
const path = require('path');

// Patch AssetUris.js para não usar URL API
const assetUrisPath = path.join(__dirname, 'node_modules/expo-asset/build/AssetUris.js');
let content = fs.readFileSync(assetUrisPath, 'utf8');

const oldFn = `export function getManifestBaseUrl(manifestUrl) {
    const urlObject = new URL(manifestUrl);
    let nextProtocol = urlObject.protocol;
    // Change the scheme to http(s) if it is exp(s)
    if (nextProtocol === 'exp:') {
        nextProtocol = 'http:';
    }
    else if (nextProtocol === 'exps:') {
        nextProtocol = 'https:';
    }
    urlObject.protocol = nextProtocol;
    // Trim filename, query parameters, and fragment, if any
    const directory = urlObject.pathname.substring(0, urlObject.pathname.lastIndexOf('/') + 1);
    urlObject.pathname = directory;
    urlObject.search = '';
    urlObject.hash = '';
    // The URL spec doesn't allow for changing the protocol to \`http\` or \`https\`
    // without a port set so instead, we'll just swap the protocol manually.
    return urlObject.protocol !== nextProtocol
        ? urlObject.href.replace(urlObject.protocol, nextProtocol)
        : urlObject.href;`;

const newFn = `export function getManifestBaseUrl(manifestUrl) {
    try {
      // Safe regex-based parsing — avoids new URL() which fails in some RN environments
      const withHttp = manifestUrl.replace(/^exps?:/, (m) => m === 'exps:' ? 'https:' : 'http:');
      const match = withHttp.match(/^(https?:\\/\\/[^\\/]+)(\\/.+)?$/);
      if (!match) return withHttp;
      const origin = match[1];
      const pathname = match[2] || '/';
      const dir = pathname.substring(0, pathname.lastIndexOf('/') + 1);
      return origin + dir;
    } catch(e) {
      return manifestUrl;
    }`;

if (content.includes('const urlObject = new URL(manifestUrl)')) {
  content = content.replace(
    /export function getManifestBaseUrl\(manifestUrl\) \{[\s\S]+?return urlObject\.protocol !== nextProtocol[\s\S]+?\}/,
    newFn + '\n}'
  );
  fs.writeFileSync(assetUrisPath, content);
  console.log('✓ AssetUris.js patched');
} else {
  console.log('Padrão não encontrado — verificar manualmente');
  console.log(content.substring(0, 300));
}
