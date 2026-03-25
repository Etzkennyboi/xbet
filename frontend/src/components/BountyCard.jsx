import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Clock, Users, ArrowRight } from 'lucide-react';

const BountyCard = ({ bounty }) => {
  return (
    <div className="bounty-card">
      <div className="bounty-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`difficulty-tag ${bounty.difficulty.toLowerCase()}`}>
            {bounty.difficulty}
          </span>
          <span className="category-tag">{bounty.category}</span>
        </div>
        <span className="bounty-reward">{bounty.reward} USDC</span>
      </div>
      
      <h3 className="bounty-task">{bounty.title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {bounty.description}
      </p>
      
      <div className="bounty-meta">
        <div className="meta-item">
          <Clock size={14} className="pulse-icon" /> 
          {Math.max(0, Math.ceil((bounty.deadline - Date.now()) / (1000 * 60 * 60 * 24)))}d left
        </div>
        <div className="meta-item">
          <Users size={14} /> 
          {bounty.slots - bounty.claimedCount} slots left
        </div>
      </div>

      <div className="bounty-card-footer" style={{ border: 'none', paddingTop: '0' }}>
        <Link to={`/bounty/${bounty.id}`} className="submit-btn" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
          View Details <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
};

export default BountyCard;
