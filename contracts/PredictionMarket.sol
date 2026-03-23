// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PredictionMarket
 * @dev Decentralized prediction market on X Layer.
 * Users bet USDC on YES/NO outcomes. Winners share the loser pool proportionally.
 * Only owner can create/resolve markets. Anyone can enter and claim.
 */
contract PredictionMarket is Ownable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant FEE_PERCENT = 5;   // 5% protocol fee on loser pool
    uint256 public constant MIN_BET = 500000;  // 0.50 USDC (6 decimals)
    uint256 public constant MAX_BET = 50000000; // 50.00 USDC (6 decimals)

    // State
    IERC20 public usdc;
    address public treasury;
    uint256 public marketCount;

    // Market structure
    struct Market {
        bytes32 id;
        string question;
        uint256 targetPrice;
        uint256 expiresAt;
        uint256 yesPool;
        uint256 noPool;
        bool resolved;
        bool result; // true = YES wins, false = NO wins
        uint256 finalPrice;
    }

    // Mappings
    mapping(bytes32 => Market) public markets;
    mapping(bytes32 => mapping(address => uint256)) public yesBets;
    mapping(bytes32 => mapping(address => uint256)) public noBets;
    mapping(bytes32 => mapping(address => bool)) public claimed;

    // Events
    event MarketCreated(bytes32 indexed marketId, string question, uint256 targetPrice, uint256 expiresAt);
    event MarketEntered(bytes32 indexed marketId, address indexed user, bool betYes, uint256 amount);
    event MarketResolved(bytes32 indexed marketId, bool result, uint256 finalPrice);
    event WinningsClaimed(bytes32 indexed marketId, address indexed user, uint256 amount);

    /**
     * @dev Constructor
     * @param _usdc USDC token address on X Layer
     * @param _treasury Treasury address for protocol fees
     */
    constructor(address _usdc, address _treasury) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury address");
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    /**
     * @dev Create a new prediction market (owner only — called by AI agent backend)
     */
    function createMarket(
        string memory _question,
        uint256 _targetPrice,
        uint256 _expiresAt
    ) external onlyOwner returns (bytes32 marketId) {
        require(_expiresAt > block.timestamp, "Expiry must be in future");
        require(bytes(_question).length > 0, "Question cannot be empty");

        marketCount++;
        marketId = keccak256(abi.encodePacked(marketCount, _question, block.timestamp));

        markets[marketId] = Market({
            id: marketId,
            question: _question,
            targetPrice: _targetPrice,
            expiresAt: _expiresAt,
            yesPool: 0,
            noPool: 0,
            resolved: false,
            result: false,
            finalPrice: 0
        });

        emit MarketCreated(marketId, _question, _targetPrice, _expiresAt);
    }

    /**
     * @dev Enter a market with a variable bet amount
     * @param _marketId The market ID
     * @param _betYes True for YES, False for NO
     * @param _amount USDC amount to bet (6 decimals, min 0.50, max 50.00)
     */
    function enterMarket(bytes32 _marketId, bool _betYes, uint256 _amount) external {
        Market storage market = markets[_marketId];
        require(market.id != bytes32(0), "Market does not exist");
        require(!market.resolved, "Market already resolved");
        require(block.timestamp < market.expiresAt, "Market expired");
        require(_amount >= MIN_BET, "Below minimum bet");
        require(_amount <= MAX_BET, "Above maximum bet");

        // Transfer USDC from user to contract
        usdc.safeTransferFrom(msg.sender, address(this), _amount);

        // Record the bet
        if (_betYes) {
            yesBets[_marketId][msg.sender] += _amount;
            market.yesPool += _amount;
        } else {
            noBets[_marketId][msg.sender] += _amount;
            market.noPool += _amount;
        }

        emit MarketEntered(_marketId, msg.sender, _betYes, _amount);
    }

    /**
     * @dev Resolve a market (owner only — called by AI agent)
     */
    function resolveMarket(bytes32 _marketId, uint256 _finalPrice) external onlyOwner {
        Market storage market = markets[_marketId];
        require(market.id != bytes32(0), "Market does not exist");
        require(!market.resolved, "Already resolved");
        require(block.timestamp >= market.expiresAt, "Not yet expired");

        market.result = _finalPrice > market.targetPrice;
        market.resolved = true;
        market.finalPrice = _finalPrice;

        // Transfer protocol fee to treasury (5% of loser pool)
        uint256 loserPool = market.result ? market.noPool : market.yesPool;
        if (loserPool > 0) {
            uint256 fee = (loserPool * FEE_PERCENT) / 100;
            usdc.safeTransfer(treasury, fee);
        }

        emit MarketResolved(_marketId, market.result, _finalPrice);
    }

    /**
     * @dev Claim winnings for a resolved market
     */
    function claimWinnings(bytes32 _marketId) external {
        Market storage market = markets[_marketId];
        require(market.resolved, "Market not yet resolved");
        require(!claimed[_marketId][msg.sender], "Already claimed");

        uint256 userBet;
        uint256 winnerPool;

        if (market.result) {
            userBet = yesBets[_marketId][msg.sender];
            winnerPool = market.yesPool;
        } else {
            userBet = noBets[_marketId][msg.sender];
            winnerPool = market.noPool;
        }

        require(userBet > 0, "No bet on winning side");

        uint256 loserPool = market.result ? market.noPool : market.yesPool;
        uint256 afterFee = loserPool - ((loserPool * FEE_PERCENT) / 100);

        // Payout = original bet back + proportional share of loser pool after fee
        uint256 payout = userBet + ((afterFee * userBet) / winnerPool);

        claimed[_marketId][msg.sender] = true;
        usdc.safeTransfer(msg.sender, payout);

        emit WinningsClaimed(_marketId, msg.sender, payout);
    }

    /**
     * @dev Get pending winnings (view — for UI display)
     */
    function getPendingWinnings(bytes32 _marketId, address _user) external view returns (uint256 pending) {
        Market memory market = markets[_marketId];
        if (!market.resolved || claimed[_marketId][_user]) return 0;

        uint256 userBet = market.result ? yesBets[_marketId][_user] : noBets[_marketId][_user];
        if (userBet == 0) return 0;

        uint256 winnerPool = market.result ? market.yesPool : market.noPool;
        uint256 loserPool = market.result ? market.noPool : market.yesPool;
        uint256 afterFee = loserPool - ((loserPool * FEE_PERCENT) / 100);

        pending = userBet + ((afterFee * userBet) / winnerPool);
    }

    /**
     * @dev Get user's position in a market
     */
    function getUserPosition(bytes32 _marketId, address _user) external view returns (
        uint256 yesAmount,
        uint256 noAmount,
        bool hasClaimed
    ) {
        return (
            yesBets[_marketId][_user],
            noBets[_marketId][_user],
            claimed[_marketId][_user]
        );
    }

    /**
     * @dev Get full market details
     */
    function getMarket(bytes32 _marketId) external view returns (Market memory) {
        return markets[_marketId];
    }

    /**
     * @dev Get entry fee bounds
     */
    function getEntryFee() public pure returns (uint256) {
        return MIN_BET;
    }

    /**
     * @dev Update treasury address (owner only)
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
    }

    /**
     * @dev Emergency: Withdraw stuck tokens (owner only)
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(treasury, _amount);
    }
}
/ *   A   * /  
 