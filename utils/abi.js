const fs = require('fs');
const utils = require('web3-utils');

const files = fs.readdirSync('build/contracts');
for (let filename of files) {
    const buffer = fs.readFileSync(`build/contracts/${filename}`);
    if (!filename.endsWith('.json')) {
        continue;
    }
    console.log(filename);
    const json = buffer.toString();
    const abi = JSON.parse(json).abi;
    for (let item of abi) {
        if (item.type === 'event' || item.type === 'function') {
            let sign = item.name + '('
            let seq = '';
            for (let p of item.inputs) {
                sign += (seq + p.type);
                seq = ',';
            }
            sign += ')'
            item.hash = utils.sha3(sign);
            item.shortHash = item.hash.substring(0, 10)
        }
    }
    if (!fs.existsSync('build/abi/')) {
        fs.mkdirSync('build/abi/');
    }
    fs.writeFileSync(`build/abi/${filename}`, Buffer.from(JSON.stringify(abi, 0, 2)));
}
