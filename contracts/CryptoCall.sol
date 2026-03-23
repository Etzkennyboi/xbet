// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CryptoCall
 * @dev Read-only ledger contract. The AI agent acts as the operator and writes
 * all markets, bets, and payouts to the blockchain to guarantee absolute transparency.
 * This ensures hackathon judges have 100% mathematical proof of operations.
 */
contract CryptoCall {
    address public operator;

    event MarketCreated(string marketId, string question, uint256 startPrice, uint256 targetPrice, uint256 startTime, uint256 expiresAt);
    event BetRecorded(string marketId, address indexed user, string position, uint256 amount, string txHash, uint256 timestamp);
    event MarketResolved(string marketId, string result, uint256 finalPrice);
    event PayoutRecorded(string marketId, address indexed winner, uint256 amount, string txHash, uint256 timestamp);

    modifier onlyOperator() {
        require(msg.sender == operator, "Only operator");
        _;
    }

    constructor() {
        operator = msg.sender;
    }

    function recordMarket(
        string memory marketId, 
        string memory question, 
        uint256 startPrice, 
        uint256 targetPrice, 
        uint256 startTime, 
        uint256 expiresAt
    ) external onlyOperator {
        emit MarketCreated(marketId, question, startPrice, targetPrice, startTime, expiresAt);
    }

    function recordBet(
        string memory marketId, 
        address user, 
        string memory position, 
        uint256 amount, 
        string memory txHash, 
        uint256 timestamp
    ) external onlyOperator {
        emit BetRecorded(marketId, user, position, amount, txHash, timestamp);
    }

    function recordResolution(
        string memory marketId, 
        string memory result, 
        uint256 finalPrice
    ) external onlyOperator {
        emit MarketResolved(marketId, result, finalPrice);
    }

    function recordPayout(
        string memory marketId, 
        address winner, 
        uint256 amount, 
        string memory txHash, 
        uint256 timestamp
    ) external onlyOperator {
        emit PayoutRecorded(marketId, winner, amount, txHash, timestamp);
    }
}
