import { payWinner } from './gateway.js';

async function test() {
  const tx = await payWinner("0x5C67869272f3d167c761dBbf0DC3901a1fF214D3", "0.01");
  console.log("Result:", tx);
}
test();
