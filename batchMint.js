const prompt = require('prompt');
const { Decrypt } = require("./utils/aes");
const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
const HDWallet = require('ethereum-hdwallet')
const xenAbi = require("./abis/XENCrypto.json");

const encryptedMnemonic = ""; // input encrypt mnemonic

// const provider = 'https://rpc.ankr.com/eth'; // eth
const provider = 'https://polygon-rpc.com'; // polygon

// const xenAddr = "0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8"; // eth
const xenAddr = "0x2AB0e9e4eE70FFf1fB9D67031E44F6410170d00e"; // polygon

const chainId = 137;// 1: eth, 137: polygon

const minDay = 100; // Minimum harvest day
const maxAccount = 20000;
const waitTime = 3000;
const maxGasPrice = 40; // eth: 15, polyon: 30

const web3 = new Web3(new Web3.providers.HttpProvider(provider));
const xenContract = new web3.eth.Contract(xenAbi, xenAddr);

let basePrivate;
let baseAddress;

async function startMonitor(mywallet) {
    while (true) {
        let maxDay = await getCurrentMaxDay();
        let maxLoop = maxDay - minDay;
        for (let i = 0; i < maxAccount; i++) {
            try {
                console.log("index: ", i);
                let gasPrice = parseFloat(web3.utils.fromWei(await web3.eth.getGasPrice(), 'gwei'));
                console.log(`gas price now: ${gasPrice}`);
                if (gasPrice <= maxGasPrice) {
                    let userPriv = mywallet.derive(i).getPrivateKey().toString('hex');
                    let userAddr = "0x" + mywallet.derive(i).getAddress().toString('hex');
                    // Judging whether there is mint
                    let time = await getUserMints(userAddr);
                    if (time == 0) {
                        // not
                        let userBal = parseFloat(web3.utils.fromWei(await web3.eth.getBalance(userAddr)));
                        if (userBal == 0 && userAddr != baseAddress) {
                            await transferFee(userAddr);
                        }

                        let term = parseInt(i % maxLoop) + minDay;
                        if(term > maxDay){
                            term = maxDay;
                        }

                        await claimRank(userAddr, term, userPriv);
                        
                    } else {
                        // already mint
                        let timeNow = parseInt(new Date().getTime() / 1000);
                        if (timeNow > time) {
                            await claimMintReward(userAddr, userPriv);
                            await sleep(waitTime);
                            await transferXenToBase(userAddr, userPriv);
                            console.log(`${userAddr} claim success`)
                        } else {
                            console.log(`${userAddr} claim time: ${formatTime(time)}`)
                        }
                    }
                } else {
                    i--;
                    console.log(`gas exceed max limit: ${gasPrice}`);
                }

                await sleep(1000);

            } catch (err) {
                console.log("err: ", err.message)
            }
        }
    }
}

async function claimMintReward(from, privateKey) {
    try {
        let gasLimit = parseInt(await xenContract.methods.claimMintReward().estimateGas({ from: from }) * 1.2);
        let dataField = await xenContract.methods.claimMintReward().encodeABI();
        let value = web3.utils.toHex(0);
        await sendTransaction(from, xenAddr, value, gasLimit, dataField, privateKey);
        console.log(`${from} claim success`);
    } catch (err) {
        console.log("claimMintReward: ", err.message);
    }
}

async function transferXenToBase(from, privateKey) {
    try {
        let xenBal = await xenContract.methods.balanceOf(from).call();
        let gasLimit = parseInt(await xenContract.methods.transfer(from, baseAddress, xenBal).estimateGas({ from: from }) * 1.2);
        let dataField = await xenContract.methods.transfer(from, baseAddress, xenBal).encodeABI();
        let value = web3.utils.toHex(0);
        await sendTransaction(from, xenAddr, value, gasLimit, dataField, privateKey);
        console.log(`${from} transfer to ${baseAddress} success`);

    } catch (err) {
        console.log("transferXenToBase: ", err.message);
    }
}

async function claimRank(from, term, privateKey) {
    try {
        let gasLimit = parseInt(await xenContract.methods.claimRank(term).estimateGas({ from: from }) * 1.2);
        let dataField = await xenContract.methods.claimRank(term).encodeABI();
        let value = web3.utils.toHex(0);
        await sendTransaction(from, xenAddr, value, gasLimit, dataField, privateKey);
        console.log(`${from} mint success, term is ${term}`);
    } catch (err) {
        console.log("claimRank: ", err.message);
    }
}

async function transferFee(to) {
    try {
        let gasLimit = 21000;
        let value = web3.utils.toHex(web3.utils.toWei((maxGasPrice * 500000).toFixed(2), 'gwei'));
        let dataField = ''
        await sendTransaction(baseAddress, to, value, gasLimit, dataField, basePrivate);
        console.log(`${to} receive ${web3.utils.fromWei(value)}eth success`);
    } catch (err) {
        console.log("transferFee: ", err.message);
    }
}

async function sendTransaction(from, to, value, gasLimit, dataField, privateKey) {
    let nonce = await web3.eth.getTransactionCount(from);
    let gasPrice = await web3.eth.getGasPrice();
    let rawTx = {
        chainId: chainId,
        nonce,
        gasPrice: web3.utils.toHex(gasPrice),
        gasLimit: web3.utils.toHex(gasLimit),
        from: from,
        to: to,
        value: value,
        data: dataField
    };
    let key = Buffer.from(privateKey.replace("0x", ""), "hex");
    let tx = new Tx(rawTx);
    tx.sign(key);
    let serializedTx = tx.serialize();
    await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function getCurrentMaxDay() {
    try {
        let maxTerm = await xenContract.methods.getCurrentMaxTerm().call();
        let maxDay = parseInt(maxTerm / (86400));
        return maxDay;
    } catch (err) {
        console.log("err: ", err.message)
    }

}

async function getUserMints(userAddr) {
    try {
        let userMints = await xenContract.methods.userMints(userAddr).call();
        let time = parseInt(userMints[2]);
        return time;
    } catch (err) {
        console.log("err: ", err.message)
    }
}


// async function getGasPrice(type = "safe") {
//     let link = "https://api.etherscan.io/api?module=gastracker&action=gasoracle";
//     try {
//         const res = (await axios.get(link));
//         let price = 0;
//         if (type == 'fast') {
//             price = parseFloat(res.data.result.FastGasPrice);
//         } else {
//             price = parseFloat(res.data.result.SafeGasPrice);
//         }
//         return price;
//     } catch (err) {
//         console.log("err: ", err.message);
//     }
// }

function formatTime(timstamp) {
    var date = new Date(timstamp * 1000);
    var year = date.getFullYear(); 
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hour = date.getHours();
    var minute = date.getMinutes();
    var second = date.getSeconds();
    var forMatDate = year + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second;
    return forMatDate
}

const properties = [
    {
        message: 'Please Input Password',
        name: 'pwd',
        hidden: true
    },

];

prompt.start();
prompt.get(properties, async function (err, result) {
    if (err) { console.log("err init") }
    let mnemonic = Decrypt(encryptedMnemonic, result.pwd);
    if (mnemonic == '') {
        console.log("pwd err")
        return;
    }
    let hdwallet = HDWallet.fromMnemonic(mnemonic);
    let mywallet = hdwallet.derive(`m/44'/60'/0'/0`);
    basePrivate = mywallet.derive(0).getPrivateKey().toString('hex');
    baseAddress = "0x" + mywallet.derive(0).getAddress().toString('hex');
    console.log("base address: ", baseAddress);
    await startMonitor(mywallet);
});
