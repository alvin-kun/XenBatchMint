const CryptoJS = require('crypto-js');

function Decrypt(ciphertext, key) {
    var bytes = CryptoJS.AES.decrypt(ciphertext, key, {iv: '0123456789ABCDEF'});
    var originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
}

function Encrypt(message, key) {
    var ciphertext = CryptoJS.AES.encrypt(message, key, {iv: '0123456789ABCDEF'}).toString();
    return ciphertext;
}

module.exports = {
    Encrypt, Decrypt
}