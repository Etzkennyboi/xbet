import OpenAI from 'openai';
import axios from 'axios';

let openai = null;

function getOpenAI() {
  if (!openai && (process.env.OPENAI_API_KEY || process.env.AI_API_KEY)) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
    });
  }
  return openai;
}

/**
 * Resolves a prediction market using AI analysis
 * @param {Object} market - The market object with question, description, and endDate
 * @returns {Promise<Object>} Resolution result with outcome and confidence
 */
export async function resolveMarketWithAI(market) {
  console.log(`\n🤖 AI Agent resolving market: "${market.question}"`);
  
  // Check if OpenAI is configured
  const ai = getOpenAI();
  if (!ai) {
    console.log(`   ⚠️ OpenAI not configured - returning UNRESOLVED`);
    return {
      outcome: 'UNRESOLVED',
      confidence: 0,
      reasoning: 'AI resolver not configured - please set OPENAI_API_KEY',
      error: true
    };
  }
  
  try {
    // Gather evidence from multiple sources
    const evidence = await gatherEvidence(market);
    
    // Use OpenAI to analyze the evidence and determine outcome
    const resolution = await analyzeWithAI(market, evidence, ai);
    
    console.log(`   ✅ AI Resolution: ${resolution.outcome} (${(resolution.confidence * 100).toFixed(1)}% confidence)`);
    console.log(`   📝 Reasoning: ${resolution.reasoning.substring(0, 150)}...`);
    
    return resolution;
  } catch (err) {
    console.error(`   ❌ AI Resolution failed: ${err.message}`);
    // Fallback: return unresolved with error
    return {
      outcome: 'UNRESOLVED',
      confidence: 0,
      reasoning: `Resolution failed: ${err.message}`,
      error: true
    };
  }
}

/**
 * Gathers evidence from various sources based on market category
 * @param {Object} market - Market object
 * @returns {Promise<Object>} Gathered evidence
 */
async function gatherEvidence(market) {
  const evidence = {
    marketInfo: {
      question: market.question,
      description: market.description,
      endDate: market.endDate,
      category: market.category || 'General'
    },
    currentDate: new Date().toISOString(),
    searchResults: []
  };
  
  // For crypto-related markets, fetch current prices
  if (market.category?.toLowerCase().includes('crypto') || 
      market.question.toLowerCase().includes('bitcoin') ||
      market.question.toLowerCase().includes('btc') ||
      market.question.toLowerCase().includes('ethereum') ||
      market.question.toLowerCase().includes('eth')) {
    try {
      const priceData = await fetchCryptoPrices();
      evidence.cryptoPrices = priceData;
    } catch (e) {
      console.warn(`[AI Resolver] Could not fetch crypto prices: ${e.message}`);
    }
  }
  
  // For political/world event markets
  if (market.category?.toLowerCase().includes('politic') ||
      market.question.toLowerCase().includes('election') ||
      market.question.toLowerCase().includes('war') ||
      market.question.toLowerCase().includes('ceasefire')) {
    evidence.newsContext = 'Real-world events should be verified through official sources and credible media reporting.';
  }
  
  return evidence;
}

/**
 * Fetches current crypto prices from CoinGecko
 * @returns {Promise<Object>} Price data
 */
async function fetchCryptoPrices() {
  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd',
      { timeout: 5000 }
    );
    return response.data;
  } catch (err) {
    throw new Error(`Failed to fetch crypto prices: ${err.message}`);
  }
}

/**
 * Analyzes evidence using OpenAI GPT
 * @param {Object} market - Market object
 * @param {Object} evidence - Gathered evidence
 * @returns {Promise<Object>} AI analysis result
 */
async function analyzeWithAI(market, evidence, openai) {
  const prompt = `You are an AI market resolver for a prediction market. Your task is to determine the outcome of the following market based on available evidence.

**Market Question:** ${market.question}

**Market Description:** ${market.description || 'No additional description provided.'}

**Resolution Date:** ${market.endDate}

**Current Date:** ${evidence.currentDate}

**Evidence:**
${evidence.cryptoPrices ? `\nCurrent Crypto Prices:\n- Bitcoin: $${evidence.cryptoPrices.bitcoin?.usd || 'N/A'}\n- Ethereum: $${evidence.cryptoPrices.ethereum?.usd || 'N/A'}` : ''}
${evidence.newsContext ? `\nContext: ${evidence.newsContext}` : ''}

**Instructions:**
1. Analyze if the market question can be definitively answered based on the evidence
2. For future events that haven't happened yet, return UNRESOLVED
3. For events that have clear outcomes, return YES or NO
4. Provide your confidence level (0.0 to 1.0)
5. Explain your reasoning

**Response Format (JSON):**
{
  "outcome": "YES" | "NO" | "UNRESOLVED",
  "confidence": 0.0-1.0,
  "reasoning": "detailed explanation"
}

Respond ONLY with the JSON object.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a precise prediction market resolver. You only make determinations when evidence is clear. You respond in valid JSON format only.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 500
  });
  
  const responseText = completion.choices[0].message.content;
  
  // Parse JSON response
  try {
    // Remove any markdown code blocks if present
    const jsonText = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(jsonText);
    
    // Validate the result
    if (!['YES', 'NO', 'UNRESOLVED'].includes(result.outcome)) {
      throw new Error(`Invalid outcome: ${result.outcome}`);
    }
    
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      result.confidence = 0.5;
    }
    
    return result;
  } catch (parseErr) {
    console.error(`[AI Resolver] Failed to parse AI response: ${responseText}`);
    throw new Error(`Invalid AI response format: ${parseErr.message}`);
  }
}

/**
 * Validates if a market is ready for resolution
 * @param {Object} market - Market object
 * @returns {Object} Validation result
 */
export function canResolveMarket(market) {
  const endDate = new Date(market.endDate);
  const now = new Date();
  
  // Market can be resolved if it's past the end date
  if (now < endDate) {
    return {
      canResolve: false,
      reason: `Market not yet expired. Expires at ${endDate.toISOString()}`,
      timeRemaining: endDate - now
    };
  }
  
  return {
    canResolve: true,
    reason: 'Market is ready for resolution'
  };
}

/**
 * Batch resolves multiple expired markets
 * @param {Array} markets - Array of market objects
 * @returns {Promise<Array>} Array of resolution results
 */
export async function batchResolveMarkets(markets) {
  const results = [];
  
  for (const market of markets) {
    const validation = canResolveMarket(market);
    
    if (!validation.canResolve) {
      results.push({
        marketId: market.id,
        resolved: false,
        reason: validation.reason
      });
      continue;
    }
    
    try {
      const resolution = await resolveMarketWithAI(market);
      results.push({
        marketId: market.id,
        resolved: resolution.outcome !== 'UNRESOLVED',
        outcome: resolution.outcome,
        confidence: resolution.confidence,
        reasoning: resolution.reasoning
      });
    } catch (err) {
      results.push({
        marketId: market.id,
        resolved: false,
        error: err.message
      });
    }
  }
  
  return results;
}
