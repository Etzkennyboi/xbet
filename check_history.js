const { execSync } = require('child_process');
const path = require('path');
const config = require('./src/config/env');

const onchainosPath = path.join(process.env.USERPROFILE, '.local', 'bin', 'onchainos.exe');

const addr = '0x5c67869272f3d167c761dbbf0dc3901a1ff214d3';
const args = `wallet history --chain 196 --address ${addr}`;

const env = { 
  ...process.env,
  OKX_API_KEY: config.okx.apiKey,
  OKX_SECRET_KEY: config.okx.secretKey,
  OKX_PASSPHRASE: config.okx.passphrase
};

try {
  const stdout = execSync(`"${onchainosPath}" ${args}`, { env, encoding: 'utf8' });
  const start = stdout.indexOf('{');
  const res = JSON.parse(stdout.substring(start));
  console.log(JSON.stringify(res.data[0].orderList.slice(0, 5), null, 2));
} catch (error) {
  console.error('ERROR:', error.message);
}
