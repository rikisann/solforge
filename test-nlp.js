const {IntentParser} = require('./dist/engine/intent-parser');
const PAYER = '9P7YMMV8TiA2ZDgdAkK3qbdKuQJYE3PSSJzKW3YHLRn3';
const ADDR = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

const prompts = [
  // SWAPS - basic verbs
  'swap 1 SOL for USDC',
  'swap 2 SOL to BONK',
  'exchange 5 SOL for BONK',
  'exchange 5 SOL into BONK',
  'convert 10 USDC to SOL',
  'trade 3 SOL for USDC',
  'trade 3 SOL for USDC with 1% slippage',
  'change 50 USDT to USDC',
  'swap SOL for BONK',
  'swap SOL to USDC',
  'flip SOL to USDC',
  // SWAPS - natural language
  'I want to swap 2 SOL for USDC',
  'please swap 1 SOL to USDC',
  'can you swap 5 SOL for BONK',
  // SWAPS - with mint address
  `swap 1 SOL for ${MINT}`,
  // SWAPS - DEX specific
  'swap 1 SOL for USDC on raydium',
  'swap 1 SOL for USDC on orca',
  'swap 1 SOL for USDC on meteora',
  // BUY variations
  'buy 5 BONK',
  'buy BONK',
  'buy some BONK',
  'purchase BONK',
  'get me BONK',
  'buy 5 SOL worth of BONK',
  'buy 5 SOL of BONK',
  'buy BONK with 5 SOL',
  'get me 2 SOL of USDC',
  // SELL variations
  'sell BONK',
  'sell 100 BONK',
  'sell 100 BONK for SOL',
  'sell my BONK',
  'sell my BONK for SOL',
  'dump BONK',
  'sell all BONK',
  // DEGEN slang
  'ape 5 SOL into BONK',
  'ape into BONK',
  `ape 5 SOL into ${MINT}`,
  'yolo 1 SOL into BONK',
  'long BONK with 2 SOL',
  'short BONK',
  // TRANSFERS
  `send 1 SOL to ${ADDR}`,
  `transfer 0.5 SOL to ${ADDR}`,
  `pay ${ADDR} 1 SOL`,
  `send ${ADDR} 2 USDC`,
  `transfer 100 USDC to ${ADDR}`,
  // STAKING
  'stake 5 SOL',
  'liquid stake 5 SOL',
  'stake 5 SOL with marinade',
  'unstake 5 mSOL',
  'withdraw stake',
  // MEMOS
  'memo hello world',
  'write memo gm',
  'onchain memo: test',
  'post memo: hello',
  'memo "hello solana"',
  // TIPS
  'tip jito 0.01 SOL',
  'jito tip 0.01',
  'tip 0.01 to jito',
  'tip 0.01 SOL to jito',
  'send jito tip',
  // CHAINED
  'swap 1 SOL for USDC and tip 0.01 to jito',
  `send 1 SOL to ${ADDR} then write memo gm`,
  'buy BONK and tip jito 0.01',
];

let pass = 0, fail = 0;
const failures = [];
for (const p of prompts) {
  try {
    const r = IntentParser.parseNaturalLanguage({prompt: p, payer: PAYER});
    console.log(`✅ ${p} → ${r.protocol}:${r.action}`);
    pass++;
  } catch(e) {
    console.log(`❌ ${p} → ${e.message.split('\n')[0].slice(0,80)}`);
    fail++;
    failures.push(p);
  }
}
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (failures.length) {
  console.log('FAILURES:');
  failures.forEach(f => console.log(`  - ${f}`));
}
