import fs from 'fs';
import path from 'path';

const binPath = path.join(process.env.USERPROFILE, '.local', 'bin', 'onchainos.exe');
if (!fs.existsSync(binPath)) {
    console.log('Binary not found at', binPath);
    process.exit(1);
}

const buffer = fs.readFileSync(binPath);
let results = [];

const search = (term) => {
    let hex = Buffer.from(term);
    for (let i = 0; i < buffer.length - hex.length; i++) {
        let match = true;
        for (let k = 0; k < hex.length; k++) {
            if (buffer[i+k] !== hex[k]) {match = false;break;}
        }
        if (match) {
            let start = i;
            while(start > 0 && buffer[start-1] >= 32 && buffer[start-1] <= 126) start--;
            let end = i;
            while(end < buffer.length && buffer[end] >= 32 && buffer[end] <= 126) end++;
            results.push(buffer.slice(start, end).toString());
        }
    }
}

search('/priapi/v5/');

console.log('Found', results.length, 'matches:');
console.log([...new Set(results)].sort().join('\n'));
