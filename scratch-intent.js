const { bridgeIntent } = require('./Fast-bridge-xlayer0/src/skills/bridgeIntent.js');

async function main() {
    const params = {
        srcChain: 'ethereum',
        dstChain: 'xlayer',
        token: 'USDT', // use USDT or USDT0 based on chain? 
        amount: '1.7',
        recipient: '0x1ef1034e7cd690b40a329bd64209ce563f95bb5c',
        agentAddress: '0x1ef1034e7cd690b40a329bd64209ce563f95bb5c',
        refundAddress: '0x1ef1034e7cd690b40a329bd64209ce563f95bb5c'
    };
    try {
        const res = await bridgeIntent(params);
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error(e.message);
    }
}
main();
