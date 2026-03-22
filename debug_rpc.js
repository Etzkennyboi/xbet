// Test: can we look up a specific transaction hash directly?
const { ethers } = require('ethers')

const provider = new ethers.JsonRpcProvider('https://rpc.xlayer.tech')
const WALLET_A = '0x5C67869272f3d167c761dBbf0DC3901a1fF214D3'.toLowerCase()
const AGENT   = '0x1ef1034e7cd690b40a329bd64209ce563f95bb5c'.toLowerCase()

// Known TX hashes from the wallet_a_clean.json we fetched earlier via onchainos
const knownHashes = [
  '0x100010f46455f8ae9ab11a3a77010abc7763a32fe880d046283fd6771b3d12b1',
  '0x8469e568ff96d7d86d45932759d15679cc5cd8e8350eb816639a577e99cace89',
  '0x761f2a15089e0ff460ba88b300a52e6a9c0a2861055b4bebca4e4703bebc5607',
  '0xcb21fff93c0260c7a6c8114eee73672994a630839da68e1719d5141fd75795df',
  '0x5d93a597c87934344fbf3984b787f8f02a33b8f81f1e82000816b1685dd4739b',
  '0x20d94f5ea884639d25dbb7cf2b8bc2e3311b5ed92701a4da9e3b3e1bb6c58ecb',
  '0x36ab416c34783b7b37b1b43325ccb42b6fef5bc52a37aa78da6223192cacf299',
  '0xb3224bc270eb7eaed8ba49ca145c6829189bff2542dfbc20c21b92bd8306a1d9',
  '0xd1a2d626a1ab51270917dbff05e84b885520e797998c7527e62c140eca89f52e',
  '0x758b1c1c226599425c76a2c7f9bbf30cd94b10dd73638dac661e2f8c40eb8a3a',
]

async function main() {
  console.log('=== Looking up known tx hashes via RPC ===\n')
  
  for (const hash of knownHashes) {
    try {
      const tx = await provider.getTransaction(hash)
      if (!tx) {
        console.log(`${hash.substring(0,10)}... NOT FOUND`)
        continue
      }
      const toCode = await provider.getCode(tx.to)
      const isContract = toCode !== '0x'
      
      // Get receipt for logs
      const receipt = await provider.getTransactionReceipt(hash)
      
      console.log(`TX: ${hash.substring(0,10)}...`)
      console.log(`  From: ${tx.from}`)
      console.log(`  To: ${tx.to}`)
      console.log(`  To is Contract? ${isContract}`)
      console.log(`  Value: ${ethers.formatEther(tx.value)} OKB`)
      console.log(`  Input data: ${tx.data.substring(0, 10)}`)
      console.log(`  From is Agent? ${tx.from.toLowerCase() === AGENT}`)
      console.log(`  From is Wallet A? ${tx.from.toLowerCase() === WALLET_A}`)
      console.log(`  Log count: ${receipt.logs.length}`)
      console.log('')
    } catch (err) {
      console.log(`${hash.substring(0,10)}... ERROR: ${err.message.substring(0,60)}`)
    }
  }
}

main()
