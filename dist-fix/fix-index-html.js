const fs = require('fs');
const path = './dist/index.html';

let html = fs.readFileSync(path, 'utf8');
html = html.replace(/(src|href)="\//g, '$1="'); // remove leading /
html = html.replace(/<title>(.*?)<\/title>/, `<title>$1</title><base href="/CGPTTimestamp/">`);
fs.writeFileSync(path, html);