import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Wallet, Zap } from 'lucide-react';

const Navbar = ({ connectedAddress, connectWallet, isConnecting }) => {
  const formatAddress = (addr) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  return (
    <header className="header" style={{ position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border-color)', padding: '1rem 2rem', marginBottom: '2rem' }}>
      <Link to="/" className="logo" style={{ textDecoration: 'none' }}>XBounty</Link>
      
      <nav style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>Bounties</Link>
        <Link to="/leaderboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={16} /> Leaderboard
        </Link>
        
        {connectedAddress ? (
          <div className="wallet-pill">
            <span></span> {formatAddress(connectedAddress)}
          </div>
        ) : (
          <button className="connect-btn" onClick={connectWallet} disabled={isConnecting}>
            <Wallet size={16} />
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
