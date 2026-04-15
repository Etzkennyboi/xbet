import axios from 'axios';

const POLYMARKET_API_BASE = 'https://gamma-api.polymarket.com';

/**
 * Fetches active markets from Polymarket API
 * @param {number} limit - Number of markets to fetch (default: 5)
 * @param {boolean} activeOnly - Whether to fetch only active markets (default: true)
 * @returns {Promise<Array>} Array of market objects
 */
export async function fetchPolymarketMarkets(limit = 5, activeOnly = true) {
  const url = `${POLYMARKET_API_BASE}/markets?limit=${limit}${activeOnly ? '&active=true&closed=false' : ''}`;
  
  try {
    const response = await axios.get(url, { 
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.data && Array.isArray(response.data)) {
      return response.data.map(market => ({
        id: market.id,
        question: market.question,
        description: market.description,
        endDate: market.endDate,
        slug: market.slug,
        conditionId: market.conditionId,
        image: market.image,
        liquidity: market.liquidity,
        startDate: market.startDate,
        outcomes: market.outcomes || ['Yes', 'No'],
        outcomePrices: market.outcomePrices || null,
        volume: market.volume,
        category: market.category || 'General'
      }));
    }
    
    throw new Error('Invalid response format from Polymarket API');
  } catch (err) {
    console.error(`[POLYMARKET API ERROR] ${err.message}`);
    // Fallback: return sample markets for development/testing
    return getSampleMarkets();
  }
}

/**
 * Fetches markets by specific category
 * @param {string} category - Category to filter by
 * @param {number} limit - Number of markets to fetch
 * @returns {Promise<Array>} Array of market objects
 */
export async function fetchMarketsByCategory(category, limit = 3) {
  try {
    // Fetch all markets then filter by category
    const allMarkets = await fetchPolymarketMarkets(20, true);
    const categoryMarkets = allMarkets.filter(m => 
      m.category?.toLowerCase().includes(category.toLowerCase()) ||
      category.toLowerCase().includes(m.category?.toLowerCase() || '')
    );
    
    return categoryMarkets.slice(0, limit);
  } catch (err) {
    console.error(`[POLYMARKET API ERROR] Failed to fetch ${category} markets: ${err.message}`);
    // Return category-specific sample markets
    return getSampleMarketsByCategory(category);
  }
}

/**
 * Selects one market from each category type
 * Ensures we have diverse market types
 */
export async function fetchDiverseMarkets() {
  const targetCategories = ['Politics', 'Crypto', 'Technology'];
  const selectedMarkets = [];
  
  console.log('\n🔍 Fetching diverse market types from Polymarket...');
  
  for (const category of targetCategories) {
    try {
      const markets = await fetchMarketsByCategory(category, 5);
      if (markets.length > 0) {
        // Select the market with highest liquidity in this category
        const bestMarket = markets.sort((a, b) => 
          parseFloat(b.liquidity || '0') - parseFloat(a.liquidity || '0')
        )[0];
        
        // Ensure category is set
        bestMarket.category = category;
        selectedMarkets.push(bestMarket);
        console.log(`  ✅ ${category}: "${bestMarket.question.substring(0, 50)}..."`);
      }
    } catch (err) {
      console.error(`  ❌ Failed to fetch ${category} markets:`, err.message);
    }
  }
  
  // If we didn't get all categories, fill with samples
  if (selectedMarkets.length < 3) {
    console.log(`  ⚠️ Only found ${selectedMarkets.length} categories, adding sample markets...`);
    const samples = getSampleMarkets();
    const missingCategories = targetCategories.filter(cat => 
      !selectedMarkets.some(m => m.category === cat)
    );
    
    for (let i = 0; i < missingCategories.length && selectedMarkets.length < 3; i++) {
      const sample = samples.find(s => s.category === missingCategories[i]) || samples[i];
      if (sample) {
        sample.category = missingCategories[i];
        selectedMarkets.push(sample);
        console.log(`  📋 Added ${missingCategories[i]} sample market`);
      }
    }
  }
  
  return selectedMarkets;
}

/**
 * Fetches a specific market by ID
 * @param {string} marketId - The Polymarket market ID
 * @returns {Promise<Object>} Market object
 */
export async function fetchMarketById(marketId) {
  const url = `${POLYMARKET_API_BASE}/markets/${marketId}`;
  
  try {
    const response = await axios.get(url, { 
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.data) {
      return {
        id: response.data.id,
        question: response.data.question,
        description: response.data.description,
        endDate: response.data.endDate,
        slug: response.data.slug,
        conditionId: response.data.conditionId,
        image: response.data.image,
        liquidity: response.data.liquidity,
        outcomes: response.data.outcomes || ['Yes', 'No'],
        outcomePrices: response.data.outcomePrices || null,
        resolutionSource: response.data.resolutionSource,
        category: response.data.category || 'General'
      };
    }
    
    throw new Error('Market not found');
  } catch (err) {
    console.error(`[POLYMARKET API ERROR] Failed to fetch market ${marketId}: ${err.message}`);
    return null;
  }
}

/**
 * Fetches market outcomes/prices
 * @param {string} conditionId - The market condition ID
 * @returns {Promise<Object>} Outcome data with prices
 */
export async function fetchMarketPrices(conditionId) {
  const url = `${POLYMARKET_API_BASE}/markets/prices/${conditionId}`;
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  } catch (err) {
    console.error(`[POLYMARKET API ERROR] Failed to fetch prices: ${err.message}`);
    return null;
  }
}

/**
 * Sample markets for development/fallback
 */
function getSampleMarkets() {
  return [
    {
      id: '540816',
      question: 'Will there be a Russia-Ukraine ceasefire before GTA VI releases?',
      description: 'This market resolves to "Yes" if there is an official ceasefire agreement before Grand Theft Auto VI is officially released in the US.',
      endDate: '2026-07-31T12:00:00Z',
      slug: 'russia-ukraine-ceasefire-before-gta-vi',
      conditionId: '0x9c1a953fe92c8357f1b646ba25d983aa83e90c525992db14fb726fa895cb5763',
      image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/what-will-happen-before-gta-vi-7hpNkEzQEqUE.jpg',
      liquidity: '61073.72',
      outcomes: ['Yes', 'No'],
      category: 'Politics'
    },
    {
      id: '550001',
      question: 'Will Bitcoin reach $100,000 by end of 2025?',
      description: 'This market resolves to "Yes" if Bitcoin\'s price reaches or exceeds $100,000 USD on any major exchange before January 1, 2026.',
      endDate: '2025-12-31T23:59:59Z',
      slug: 'bitcoin-100k-by-2025',
      conditionId: '0xabc123',
      image: null,
      liquidity: '250000.00',
      outcomes: ['Yes', 'No'],
      category: 'Crypto'
    },
    {
      id: '550002',
      question: 'Will AI regulation be passed in the US by Q2 2025?',
      description: 'This market resolves to "Yes" if any federal AI regulation bill is signed into law by June 30, 2025.',
      endDate: '2025-06-30T23:59:59Z',
      slug: 'ai-regulation-us-q2-2025',
      conditionId: '0xdef456',
      image: null,
      liquidity: '150000.00',
      outcomes: ['Yes', 'No'],
      category: 'Technology'
    }
  ];
}

/**
 * Get sample markets by specific category
 */
function getSampleMarketsByCategory(category) {
  const allSamples = getSampleMarkets();
  return allSamples.filter(m => 
    m.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Selects the best market based on liquidity and relevance
 * @param {Array} markets - Array of markets
 * @returns {Object} Selected market
 */
export function selectBestMarket(markets) {
  if (!markets || markets.length === 0) return null;
  
  // Sort by liquidity (highest first) and select the top one
  const sorted = markets.sort((a, b) => {
    const liquidityA = parseFloat(a.liquidity || '0');
    const liquidityB = parseFloat(b.liquidity || '0');
    return liquidityB - liquidityA;
  });
  
  // Return the market with highest liquidity
  return sorted[0];
}

/**
 * Calculates market metrics for display
 * @param {Object} market - Market object
 * @returns {Object} Calculated metrics
 */
export function calculateMarketMetrics(market) {
  const endDate = new Date(market.endDate);
  const now = new Date();
  const timeRemaining = endDate - now;
  const daysRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  
  const liquidity = parseFloat(market.liquidity || '0');
  
  return {
    daysRemaining,
    hoursRemaining,
    liquidityFormatted: liquidity.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
    isExpired: timeRemaining <= 0
  };
}
