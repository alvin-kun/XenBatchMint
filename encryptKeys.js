const { Encrypt } = require('./utils/aes');
const prompt = require('prompt');
const fs = require('fs');

const properties = [
    {
        message: 'Please enter the content to be encrypted',
        name: 'message',
        hidden: true
    },
    {
        message: 'please enter key',
        name: 'key',
        hidden: true
    },
    {
        message: 'Please enter an output file name',
        name: 'file',
        hidden: false
    }
    
];
prompt.start();

prompt.get(properties, function (err, result) {
    if (err) { return onErr(err); }
    let key = Encrypt(result.message, result.key);
    let path = "./en_" + result.file + ".txt"
    fs.writeFile(path, key, error => {
        if(error) return console.log("Writing to file failed: ", error.message);
        console.log("write success")
    })
});

function onErr(err) {
    console.log(err);
    return 1;
}