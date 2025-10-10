// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IERC20} from "@thirdweb-dev/contracts/eip/interface/IERC20.sol";
import {Ownable} from "@thirdweb-dev/contracts/extension/Ownable.sol";
import {ReentrancyGuard} from "@thirdweb-dev/contracts/external-deps/openzeppelin/security/ReentrancyGuard.sol";
import {AutomatedMarketMaker} from "./AMM.sol";

contract PredictionMarketQuadratic is Ownable, ReentrancyGuard {
    enum MarketOutcome {
        UNRESOLVED,
        OPTION_A,
        OPTION_B
    }

    uint256 public initialLiquidity;

    struct Market {
        string question;
        uint256 endTime;
        uint256 duration;
        MarketOutcome outcome;
        string optionA;
        string optionB;
        uint256 totalOptionAShares;
        uint256 totalOptionBShares;
        uint256 marketCost;  // cost fn!
        bool resolved;
        mapping(address => uint256) optionASharesBalance;
        mapping(address => uint256) optionBSharesBalance;
        mapping(address => bool) hasClaimed;
        mapping(uint256 => uint256) optionAVotesByDate; // votes per day
        mapping(uint256 => uint256) optionBVotesByDate; // votes per day
        
        // Quadratic voting - tracking vote counts per user
        mapping(address => uint256) optionAVoteCount; // number of times user voted for A
        mapping(address => uint256) optionBVoteCount; // number of times user voted for B
        
        // payment
        mapping(address => uint256) optionAPayments;
        mapping(address => uint256) optionBPayments;
        uint256 totalOptionAPayments;
        uint256 totalOptionBPayments;
    }

    IERC20 public swanToken;
    uint256 public marketCount;
    AutomatedMarketMaker public AMM;
    mapping(uint256 => Market) public markets;

    // Base token amount for quadratic voting (1 token for first vote)
    uint256 public constant BASE_VOTE_COST = 1 * 10**18; // 1 token with 18 decimals

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        string optionA,
        string optionB,
        uint256 endTime
    );

    event SharesPurchased(
        uint256 indexed marketId,
        address indexed buyer,
        bool isOptionA,
        uint256 amount,
        uint256 voteCost,
        uint256 voteCount
    );

    event MarketResolved(uint256 indexed marketId, MarketOutcome outcome);

    event Claimed(
        uint256 indexed marketId,
        address indexed user,
        uint256 amount
    );

    constructor(address _swanToken, address _ammAddress) {
        swanToken = IERC20(_swanToken);
        _setupOwner(msg.sender);
        AMM = AutomatedMarketMaker(_ammAddress);
        initialLiquidity = 5000 * 10**(18);
    }

    function _canSetOwner() internal view virtual override returns (bool) {
        return owner() == msg.sender;
    }

    function createMarket(
        string memory _question,
        string memory _optionA,
        string memory _optionB,
        uint256 _duration
    ) external returns (uint256) {
        require(_duration > 0, "Duration must be greater than 0");
        require(bytes(_question).length > 0, "Question cannot be empty");
        require(bytes(_optionA).length > 0, "Option A cannot be empty");
        require(bytes(_optionB).length > 0, "Option B cannot be empty");

        uint256 marketId = marketCount++;
        Market storage market = markets[marketId];

        market.question = _question;
        market.endTime = block.timestamp + _duration;
        market.duration = _duration;
        market.outcome = MarketOutcome.UNRESOLVED;
        market.optionA = _optionA;
        market.optionB = _optionB;

        // init cost!!!
        market.totalOptionAShares = initialLiquidity;
        market.totalOptionBShares = initialLiquidity;
        uint256 initialCost = AMM.getCost(0, 0);
        // transfer
        require(swanToken.transferFrom(msg.sender, address(this), initialCost), "Transfer failed");
        market.marketCost = initialCost;

        market.totalOptionAShares += initialCost/2;
        market.totalOptionBShares += initialCost/2;
        market.optionASharesBalance[msg.sender] += initialCost/2;
        market.optionBSharesBalance[msg.sender] += initialCost/2;

        emit MarketCreated(marketId, _question, _optionA, _optionB, market.endTime);
        return marketId;
    }

    // Calculate the quadratic cost based on the number of votes
    function calculateQuadraticCost(uint256 voteCount) public pure returns (uint256) {
        // Cost = BASE_VOTE_COST * (voteCount + 1)^2
        // +1 because this is for the next vote
        uint256 nextVoteNumber = voteCount + 1;
        return BASE_VOTE_COST * nextVoteNumber * nextVoteNumber;
    }
    
    // Get the current cost for the next vote
    function getNextVoteCost(uint256 _marketId, bool _isOptionA, address _user) public view returns (uint256) {
        Market storage market = markets[_marketId];
        uint256 voteCount = _isOptionA ? 
            market.optionAVoteCount[_user] : 
            market.optionBVoteCount[_user];
        
        return calculateQuadraticCost(voteCount);
    }

    // Get amount of shares for next vote using AMM pricing
    function getAmount(uint256 _marketId, bool _isOptionA, uint256 _shares) external view returns (uint256) {
        Market storage market = markets[_marketId];
        require(market.totalOptionAShares > 0 && market.totalOptionBShares > 0, "Not enough liquidity!");
        
        uint256 total_cost = AMM.getAmount(
            market.totalOptionAShares, market.totalOptionBShares, _isOptionA, _shares
        );
        
        return total_cost;
    }

    // Buying shares with quadratic voting cost
    function buyQuadraticVote(uint256 _marketId, bool _isOptionA, uint256 _shares) external {
        Market storage market = markets[_marketId];
        require(market.endTime > block.timestamp, "Market has ended");
        require(!market.resolved, "Market has been resolved");
        require(_shares > 0, "Shares must be greater than 0");
        require(market.totalOptionAShares > 0 && market.totalOptionBShares > 0, "Not enough liquidity!");

        // Get current vote count for this user
        uint256 voteCount = _isOptionA ? 
            market.optionAVoteCount[msg.sender] : 
            market.optionBVoteCount[msg.sender];
            
        // Calculate quadratic cost for this vote
        uint256 voteCost = calculateQuadraticCost(voteCount);
        
        // Calculate AMM cost for the shares
        uint256 ammCost = AMM.getAmount(
            market.totalOptionAShares, market.totalOptionBShares, _isOptionA, _shares
        );
        
        // Total cost is AMM cost plus quadratic voting cost
        uint256 totalCost = ammCost + voteCost;
        
        // Current date for tracking daily votes
        uint256 currentDate = block.timestamp / 1 days;

        // Transfer tokens from user
        require(
            swanToken.transferFrom(msg.sender, address(this), totalCost),
            "Transfer failed"
        );
        
        // Update all the relevant counters
        if (_isOptionA) {
            market.optionASharesBalance[msg.sender] += _shares;
            market.totalOptionAShares += _shares;
            market.optionAVotesByDate[currentDate] += _shares;
            market.optionAPayments[msg.sender] += totalCost;
            market.totalOptionAPayments += totalCost;
            market.optionAVoteCount[msg.sender] += 1;
        } else {
            market.optionBSharesBalance[msg.sender] += _shares;
            market.totalOptionBShares += _shares;
            market.optionBVotesByDate[currentDate] += _shares;
            market.optionBPayments[msg.sender] += totalCost;
            market.totalOptionBPayments += totalCost;
            market.optionBVoteCount[msg.sender] += 1;
        }

        emit SharesPurchased(
            _marketId, 
            msg.sender, 
            _isOptionA, 
            _shares, 
            voteCost,
            _isOptionA ? market.optionAVoteCount[msg.sender] : market.optionBVoteCount[msg.sender]
        );
    }

    // Function to buy shares directly with a fixed amount (compatible with old system)
    function buyShares(
        uint256 _marketId,
        bool _isOptionA,
        uint256 _amount
    ) external {
        Market storage market = markets[_marketId];
        require(market.endTime > block.timestamp, "Market has ended");
        require(_amount > 0, "Amount must be greater than 0");
        require(!market.resolved, "Market has been resolved");

        uint256 currentDate = block.timestamp / 1 days;

        require(
            swanToken.transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );
        
        if (_isOptionA) {
            market.optionASharesBalance[msg.sender] += _amount;
            market.totalOptionAShares += _amount;
            market.optionAVotesByDate[currentDate] += _amount;
            market.optionAPayments[msg.sender] += _amount;
            market.totalOptionAPayments += _amount;
            market.optionAVoteCount[msg.sender] += 1;
        } else {
            market.optionBSharesBalance[msg.sender] += _amount;
            market.totalOptionBShares += _amount;
            market.optionBVotesByDate[currentDate] += _amount;
            market.optionBPayments[msg.sender] += _amount;
            market.totalOptionBPayments += _amount;
            market.optionBVoteCount[msg.sender] += 1;
        }

        emit SharesPurchased(
            _marketId, 
            msg.sender, 
            _isOptionA, 
            _amount, 
            _amount,
            _isOptionA ? market.optionAVoteCount[msg.sender] : market.optionBVoteCount[msg.sender]
        );
    }

    // Get user vote counts
    function getUserVoteCounts(uint256 _marketId, address _user) external view returns (uint256 optionACount, uint256 optionBCount) {
        Market storage market = markets[_marketId];
        return (market.optionAVoteCount[_user], market.optionBVoteCount[_user]);
    }

    function getMarketCost(uint256 _marketId) external view returns (uint256) {
        return markets[_marketId].marketCost;
    }

    function getMarketPayments(uint256 _marketId) external view returns (
        uint256 totalOptionAPayments,
        uint256 totalOptionBPayments
    ) {
        Market storage market = markets[_marketId];
        return (
            market.totalOptionAPayments,
            market.totalOptionBPayments
        );
    }

    function addLiquidity(uint256 _marketId, uint256 amountA, uint256 amountB) external {
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");

        Market storage market = markets[_marketId];

        // calculate cost
        uint256 newCost = AMM.getCost(
            market.totalOptionAShares + amountA,
            market.totalOptionBShares + amountB
        );

        uint256 deltaCost = newCost - market.marketCost;

        // update markets
        market.marketCost = newCost;
        market.totalOptionAShares += amountA;
        market.totalOptionBShares += amountB;

        // transfer
        require(swanToken.transferFrom(msg.sender, address(this), deltaCost), "Transfer failed");
    }

    function getVotesByDate(
        uint256 _marketId,
        uint256 _date
    ) external view returns (uint256 optionAVotes, uint256 optionBVotes) {
        Market storage market = markets[_marketId];
        return (
            market.optionAVotesByDate[_date],
            market.optionBVotesByDate[_date]
        );
    }

    function getAllVotesByDate(
        uint256 _marketId
    )
        external
        view
        returns (
            uint256[] memory dates,
            uint256[] memory optionAVotes,
            uint256[] memory optionBVotes
        )
    {
        Market storage market = markets[_marketId];
        uint256 startTime = market.endTime - market.duration;
        uint256 startDate = startTime / 1 days;
        uint256 endDate = market.endTime / 1 days;
        uint256 length = endDate - startDate + 1;

        dates = new uint256[](length);
        optionAVotes = new uint256[](length);
        optionBVotes = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            uint256 date = startDate + i;
            dates[i] = date;
            optionAVotes[i] = market.optionAVotesByDate[date];
            optionBVotes[i] = market.optionBVotesByDate[date];
        }

        return (dates, optionAVotes, optionBVotes);
    }

    function resolveMarket(uint256 _marketId, MarketOutcome _outcome) external {
        // require(msg.sender == owner(), "Only owner can resolve markets");
        Market storage market = markets[_marketId];
        require(market.endTime < block.timestamp, "Market has not ended");
        require(!market.resolved, "Market has already been resolved");
        require(_outcome != MarketOutcome.UNRESOLVED, "Outcome cannot be unresolved");

        market.totalOptionAShares -= initialLiquidity;
        market.totalOptionBShares -= initialLiquidity;
        market.outcome = _outcome;
        market.resolved = true;

        emit MarketResolved(_marketId, _outcome);
    }

    function claimWinnings(uint256 _marketId) external {
        Market storage market = markets[_marketId];
        require(market.resolved, "Market has not been resolved");
        require(!market.hasClaimed[msg.sender], "Already claimed");

        uint256 userShares = 0;
        uint256 totalWinningShares = 0;
        uint256 userPayment = 0;
        uint256 totalLosingPool = 0;

        if (market.outcome == MarketOutcome.OPTION_A) {
            // User holds option A shares (winner)
            userShares = market.optionASharesBalance[msg.sender];
            totalWinningShares = market.totalOptionAShares;
            userPayment = market.optionAPayments[msg.sender];

            // Loser pool total funds
            totalLosingPool = market.totalOptionBPayments;
            market.optionASharesBalance[msg.sender] = 0;
        } else if (market.outcome == MarketOutcome.OPTION_B) {
            // User holds option B shares (winner)
            userShares = market.optionBSharesBalance[msg.sender];
            totalWinningShares = market.totalOptionBShares;
            userPayment = market.optionBPayments[msg.sender];

            // Loser pool total funds
            totalLosingPool = market.totalOptionAPayments;
            market.optionBSharesBalance[msg.sender] = 0;
        } else {
            revert("Market has not been resolved");
        }

        require(userShares > 0, "No winnings to claim");

        // Calculate user's share of the loser pool
        uint256 totalRewardPool = totalLosingPool + AMM.getCost(0, 0);
        uint256 shareOfLosingPool = 0;
        if (totalWinningShares > 0) {
            // Distribute loser pool funds based on user's proportion in winning pool
            shareOfLosingPool = (userShares * totalRewardPool) / totalWinningShares;
        }

        // Total winnings = user payments + share of loser pool
        uint256 totalWinnings = userPayment + shareOfLosingPool;

        // Mark user as claimed
        market.hasClaimed[msg.sender] = true;

        // Transfer winnings to user
        require(swanToken.transfer(msg.sender, totalWinnings), "Transfer failed");
        emit Claimed(_marketId, msg.sender, totalWinnings);
    }

    function getMarginalPrices(uint256 _marketId) external view returns (uint256 priceA, uint256 priceB) {
        Market storage market = markets[_marketId];

        require(_marketId < marketCount, "Market does not exist");

        uint256 totalSharesA = market.totalOptionAShares;
        uint256 totalSharesB = market.totalOptionBShares;

        return AMM.getPrices(totalSharesA, totalSharesB);
    }

    function getMarketInfo(
        uint256 _marketId
    )
        external
        view
        returns (
            string memory question,
            uint256 endTime,
            uint256 duration,
            MarketOutcome outcome,
            string memory optionA,
            string memory optionB,
            uint256 totalOptionAShares,
            uint256 totalOptionBShares,
            bool resolved
        )
    {
        Market storage market = markets[_marketId];
        return (
            market.question,
            market.endTime,
            market.duration,
            market.outcome,
            market.optionA,
            market.optionB,
            market.totalOptionAShares,
            market.totalOptionBShares,
            market.resolved
        );
    }

    function getSharesBalance(
        uint256 _marketId,
        address _user
    ) external view returns (uint256 optionAShares, uint256 optionBShares) {
        Market storage market = markets[_marketId];
        return (
            market.optionASharesBalance[_user],
            market.optionBSharesBalance[_user]
        );
    }
}
