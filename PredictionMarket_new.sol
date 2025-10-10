// this file combines the AMM and PredictionMarket contracts for general markets
// if you want to combine quandratic, please modify this file
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IERC20} from "@thirdweb-dev/contracts/eip/interface/IERC20.sol";
import {Ownable} from "@thirdweb-dev/contracts/extension/Ownable.sol";
import {ReentrancyGuard} from "@thirdweb-dev/contracts/external-deps/openzeppelin/security/ReentrancyGuard.sol";
import {AutomatedMarketMaker} from "./AMM.sol";

contract PredictionMarketNew is Ownable, ReentrancyGuard {
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
        mapping(uint256 => uint256) optionAVotesByDate; // new
        mapping(uint256 => uint256) optionBVotesByDate; // new
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
        uint256 amount
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
        // require(msg.sender == owner(), "Only owner can create markets");
        require(_duration > 0, "Duration must be greater than 0");
        require(bytes(_question).length > 0, "Question cannot be empty");
        require(bytes(_optionA).length > 0, "Option A cannot be empty");
        require(bytes(_optionB).length > 0, "Option B cannot be empty");

        uint256 marketId = marketCount++;
        Market storage market = markets[marketId];

        market.question = _question;
        market.endTime = block.timestamp + _duration;
        market.outcome = MarketOutcome.UNRESOLVED;
        market.optionA = _optionA;
        market.optionB = _optionB;

        // init cost!!!
        uint8 decimals = 18;
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

    function getAmount(uint256 _marketId, bool _isOptionA, uint256 _shares) external view returns (uint256) {
        Market storage market = markets[_marketId];
        uint256 total_cost = AMM.getAmount(
            market.totalOptionAShares, market.totalOptionBShares, _isOptionA, _shares
        );
        return total_cost;
    }

    function buyByShares(uint256 _marketId, bool _isOptionA, uint256 _shares) external {
        Market storage market = markets[_marketId];
        require(market.totalOptionAShares > 0 && market.totalOptionBShares > 0, "Not enough liquidity!");
        require(market.endTime > block.timestamp, "Market has ended");
        require(!market.resolved, "Market has been resolved");
        require(_shares > 0, "Amount must be greater than 0");


        uint256 total_cost = AMM.getAmount(
            market.totalOptionAShares, market.totalOptionBShares, _isOptionA, _shares
        );

        uint256 currentDate = block.timestamp / 1 days;

        require(
            swanToken.transferFrom(msg.sender, address(this), total_cost),
            "Transfer failed"
        );
        if (_isOptionA) {
            market.optionASharesBalance[msg.sender] += _shares;
            market.totalOptionAShares += _shares;
            market.optionAVotesByDate[currentDate] += _shares;
            market.optionAPayments[msg.sender] += total_cost;
            market.totalOptionAPayments += total_cost;
        } else {
            market.optionBSharesBalance[msg.sender] += _shares;
            market.totalOptionBShares += _shares;
            market.optionBVotesByDate[currentDate] += _shares;
            market.optionBPayments[msg.sender] += total_cost;
            market.totalOptionBPayments += total_cost;
        }

        emit SharesPurchased(_marketId, msg.sender, _isOptionA, _shares);

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

    function buyShares(
        uint256 _marketId,
        bool _isOptionA,
        uint256 _share
    ) external {
        Market storage market = markets[_marketId];
        require(market.endTime > block.timestamp, "Market has ended");
        require(_share > 0, "Share must be greater than 0");
        require(!market.resolved, "Market has been resolved");

        uint256 currentDate = block.timestamp / 1 days;

        require(
            swanToken.transferFrom(msg.sender, address(this), _share),
            "Transfer failed"
        );
        if (_isOptionA) {
            market.optionASharesBalance[msg.sender] += _share;
            market.totalOptionAShares += _share;
            market.optionAVotesByDate[currentDate] += _share;
        } else {
            market.optionBSharesBalance[msg.sender] += _share;
            market.totalOptionBShares += _share;
            market.optionBVotesByDate[currentDate] += _share;
        }

        emit SharesPurchased(_marketId, msg.sender, _isOptionA, _share);
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

        uint8 decimals = 18;
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
            // 用户持有A选项股份（获胜方）
            userShares = market.optionASharesBalance[msg.sender];
            totalWinningShares = market.totalOptionAShares;
            userPayment = market.optionAPayments[msg.sender];

            // 输家池的总资金
            totalLosingPool = market.totalOptionBPayments;
            market.optionASharesBalance[msg.sender] = 0;
        } else if (market.outcome == MarketOutcome.OPTION_B) {
            // 用户持有B选项股份（获胜方）
            userShares = market.optionBSharesBalance[msg.sender];
            totalWinningShares = market.totalOptionBShares;
            userPayment = market.optionBPayments[msg.sender];

            // 输家池的总资金
            totalLosingPool = market.totalOptionAPayments;
            market.optionBSharesBalance[msg.sender] = 0;
        } else {
            revert("Market has not been resolved");
        }

        require(userShares > 0, "No winnings to claim");


        // 计算用户应得的输家池份额
        uint256 totalRewardPool = totalLosingPool + AMM.getCost(0, 0);
        uint256 shareOfLosingPool = 0;
        if (totalWinningShares > 0) {
            // 根据用户在获胜池中的份额比例分配输家池资金
            shareOfLosingPool = (userShares * totalRewardPool) / totalWinningShares;
        }

        // 总奖金 = 用户投入 + 分得的输家池份额
        uint256 totalWinnings = userPayment + shareOfLosingPool;

        // 标记用户已领取
        market.hasClaimed[msg.sender] = true;

        // 转账奖金给用户
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
        ) {
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
