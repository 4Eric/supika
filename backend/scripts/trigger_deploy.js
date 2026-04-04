const https = require('https');
const url = 'https://api.render.com/deploy/srv-d6ej3r7gi27c73fc8kag?key=szoiMuHoAVg';
https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Status:', res.statusCode, data));
}).on('error', e => console.error(e.message));
