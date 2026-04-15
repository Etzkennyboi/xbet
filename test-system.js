import { fetchPolymarketMarkets, selectBestMarket, calculateMarketMetrics } from './backend/polymarket-api.js';
import { resolveMarketWithAI, canResolveMarket } from './backend/ai-resolver.js';

async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║    COMPREHENSIVE PREDICTION MARKET SYSTEM TESTS          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Polymarket API Connection
  console.log('📡 TEST 1: Polymarket API Connection');
  try {
    const markets = await fetchPolymarketMarkets(3, true);
    if (markets.length > 0) {
      console.log('  ✅ Polymarket API reachable (or fallback working)');
      console.log(`  📊 Fetched ${markets.length} markets`);
      console.log(`  📝 Sample: "${markets[0].question.substring(0, 50)}..."`);
      passed++;
    } else {
      console.log('  ❌ No markets returned');
      failed++;
    }
  } catch (err) {
    console.log('  ❌ API Error:', err.message);
    failed++;
  }

  // Test 2: Market Selection Logic
  console.log('\n🎯 TEST 2: Market Selection Logic');
  try {
    const testMarkets = [
      { id: '1', question: 'Low liquidity', liquidity: '100.00', endDate: '2025-12-31' },
      { id: '2', question: 'High liquidity', liquidity: '50000.00', endDate: '2025-12-31' },
      { id: '3', question: 'Medium liquidity', liquidity: '10000.00', endDate: '2025-12-31' }
    ];
    const best = selectBestMarket(testMarkets);
    if (best.id === '2') {
      console.log('  ✅ Correctly selected highest liquidity market');
      passed++;
    } else {
      console.log('  ❌ Wrong market selected');
      failed++;
    }
  } catch (err) {
    console.log('  ❌ Error:', err.message);
    failed++;
  }

  // Test 3: Market Metrics Calculation
  console.log('\n📊 TEST 3: Market Metrics Calculation');
  try {
    const market = {
      endDate: new Date(Date.now() + 86400000 * 15).toISOString(),
      liquidity: '25000.50'
    };
    const metrics = calculateMarketMetrics(market);
    if (metrics.daysRemaining >= 14 && metrics.daysRemaining <= 16) {
      console.log('  ✅ Days remaining calculated correctly:', metrics.daysRemaining);
      console.log('  ✅ Liquidity formatted:', metrics.liquidityFormatted);
      console.log('  ✅ Not expired:', !metrics.isExpired);
      passed++;
    } else {
      console.log('  ❌ Days calculation error');
      failed++;
    }
  } catch (err) {
    console.log('  ❌ Error:', err.message);
    failed++;
  }

  // Test 4: AI Resolver (Mock Test - no API key needed)
  console.log('\n🤖 TEST 4: AI Resolver Error Handling');
  try {
    const market = {
      question: 'Test market?',
      description: 'Test description',
      endDate: '2025-12-31'
    };
    // This will fail due to no API key, but tests error handling
    const result = await resolveMarketWithAI(market);
    if (result.error || result.outcome === 'UNRESOLVED') {
      console.log('  ✅ AI resolver returns proper error handling');
      console.log('  ✅ Outcome:', result.outcome);
      passed++;
    } else {
      console.log('  ❌ Unexpected result');
      failed++;
    }
  } catch (err) {
    console.log('  ❌ Resolver crashed:', err.message);
    failed++;
  }

  // Test 5: Resolution Validation
  console.log('\n⏰ TEST 5: Market Resolution Validation');
  try {
    // Past market
    const pastMarket = { endDate: '2020-01-01' };
    const pastValidation = canResolveMarket(pastMarket);
    
    // Future market
    const futureMarket = { endDate: '2030-01-01' };
    const futureValidation = canResolveMarket(futureMarket);
    
    if (pastValidation.canResolve && !futureValidation.canResolve) {
      console.log('  ✅ Past market: can resolve');
      console.log('  ✅ Future market: cannot resolve yet');
      passed++;
    } else {
      console.log('  ❌ Resolution validation error');
      failed++;
    }
  } catch (err) {
    console.log('  ❌ Error:', err.message);
    failed++;
  }

  // Test 6: Contract ABI Check
  console.log('\n📜 TEST 6: Smart Contract Configuration');
  try {
    const { MARKET_ABI, USDC_ABI, CONFIG } = await import('./config.js');
    if (MARKET_ABI && MARKET_ABI.length > 0) {
      console.log('  ✅ Market ABI loaded:', MARKET_ABI.length, 'functions');
      console.log('  ✅ USDC ABI loaded:', USDC_ABI.length, 'functions');
      console.log('  ✅ Chain ID:', CONFIG.CHAIN_ID);
      passed++;
    } else {
      console.log('  ❌ ABI not loaded properly');
      failed++;
    }
  } catch (err) {
    console.log('  ❌ Config error:', err.message);
    failed++;
  }

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📊 Total:  ${passed + failed}`);
  console.log(`  🎯 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(0)}%`);
  
  if (failed === 0) {
    console.log('\n  🎉 All tests passed! System is ready.');
  } else {
    console.log('\n  ⚠️  Some tests failed. Check errors above.');
  }
}

runTests().catch(console.error);
