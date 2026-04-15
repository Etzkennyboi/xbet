#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from 'fs';
import path from 'path';

const DATA_DIR = './data';
const BACKUP_DIR = './data/backup';

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║                    DATA CLEANUP UTILITY                        ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Ensure directories exist
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = Date.now();

// Clean up market.json - keep only Polymarket-style markets
console.log('🧹 Cleaning market.json...');
try {
  const marketPath = path.join(DATA_DIR, 'market.json');
  const data = JSON.parse(readFileSync(marketPath, 'utf8'));
  
  if (Array.isArray(data)) {
    // Filter to keep only Polymarket-style markets (source: 'polymarket')
    const polymarketMarkets = data.filter(m => m.source === 'polymarket' && m.status === 'open');
    
    // Backup old data
    const backupPath = path.join(BACKUP_DIR, `market_backup_${timestamp}.json`);
    writeFileSync(backupPath, JSON.stringify(data, null, 2));
    
    // Write cleaned data
    writeFileSync(marketPath, JSON.stringify(polymarketMarkets, null, 2));
    
    console.log(`  ✅ Kept ${polymarketMarkets.length} Polymarket market(s)`);
    console.log(`  🗑️  Removed ${data.length - polymarketMarkets.length} legacy market(s)`);
    console.log(`  💾 Backup saved to: ${backupPath}`);
  }
} catch (err) {
  console.log(`  ⚠️  Error: ${err.message}`);
}

// Clean up bets.json - keep only bets for active markets
console.log('\n🧹 Cleaning bets.json...');
try {
  const marketPath = path.join(DATA_DIR, 'market.json');
  const betsPath = path.join(DATA_DIR, 'bets.json');
  
  const markets = JSON.parse(readFileSync(marketPath, 'utf8'));
  const marketIds = new Set(markets.map(m => m.id));
  
  const bets = JSON.parse(readFileSync(betsPath, 'utf8'));
  const activeBets = bets.filter(b => marketIds.has(b.marketId));
  
  // Backup old data
  const backupPath = path.join(BACKUP_DIR, `bets_backup_${timestamp}.json`);
  writeFileSync(backupPath, JSON.stringify(bets, null, 2));
  
  // Write cleaned data
  writeFileSync(betsPath, JSON.stringify(activeBets, null, 2));
  
  console.log(`  ✅ Kept ${activeBets.length} active bet(s)`);
  console.log(`  🗑️  Removed ${bets.length - activeBets.length} orphaned bet(s)`);
  console.log(`  💾 Backup saved to: ${backupPath}`);
} catch (err) {
  console.log(`  ⚠️  Error: ${err.message}`);
}

// Archive old history
console.log('\n🧹 Archiving history.json...');
try {
  const historyPath = path.join(DATA_DIR, 'history.json');
  
  if (existsSync(historyPath)) {
    const data = JSON.parse(readFileSync(historyPath, 'utf8'));
    
    if (Array.isArray(data) && data.length > 0) {
      const archivePath = path.join(BACKUP_DIR, `history_archive_${timestamp}.json`);
      writeFileSync(archivePath, JSON.stringify(data, null, 2));
      
      // Keep only last 10 resolved markets in main history
      const recentHistory = data.slice(-10);
      writeFileSync(historyPath, JSON.stringify(recentHistory, null, 2));
      
      console.log(`  ✅ Archived ${data.length} historical market(s)`);
      console.log(`  📊 Keeping ${recentHistory.length} recent in main file`);
      console.log(`  💾 Archive saved to: ${archivePath}`);
    } else {
      console.log(`  ℹ️  History file is empty, no action needed`);
    }
  }
} catch (err) {
  console.log(`  ⚠️  Error: ${err.message}`);
}

// Summary
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║                      CLEANUP COMPLETE                          ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('\n💡 To restore from backup, copy files from data/backup/');
