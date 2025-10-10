const { ethers } = require("hardhat");

// npx hardhat run scripts/resolveMarket.js --network kairos

const marketContractAddress = process.env.PREDICTION_MARKET_CONTRACT_ADDRESS; 

// 枚举 MarketOutcome 的值
const MarketOutcome = {
    UNRESOLVED: 0,
    OPTION_A: 1,
    OPTION_B: 2
};

// 配置需要解析的市场信息
const marketId = 0; // 替换为要解析的 marketId
const outcome = MarketOutcome.OPTION_B; // 修改为 OPTION_A 或 OPTION_B

async function main() {
    // 获取签名账户（合约 owner）
    const [deployer] = await ethers.getSigners();
    console.log(`Using deployer address: ${deployer.address}`);

    // 加载 PredictionMarket 合约
    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
    const pmContract = await PredictionMarket.attach(marketContractAddress);

    // 确认账户是合约的 owner
    const owner = await pmContract.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error("Error: Deployer is not the owner of the PredictionMarket contract.");
        return;
    }

    // 获取 market 信息
    const marketInfo = await pmContract.getMarketInfo(marketId);
    const currentTime = Math.floor(Date.now() / 1000);

    if (marketInfo.endTime > currentTime) {
        console.error("Error: Market has not ended yet.");
        return;
    }

    if (marketInfo.resolved) {
        console.error("Error: Market has already been resolved.");
        return;
    }

    console.log(`Resolving Market ID ${marketId} with outcome: ${outcome === 1 ? "OPTION_A" : "OPTION_B"}`);

    // 调用 resolveMarket 方法
    const tx = await pmContract.resolveMarket(marketId, outcome);
    await tx.wait();

    console.log(`Market resolved! Transaction hash: ${tx.hash}`);

    // 验证市场状态
    const updatedMarketInfo = await pmContract.getMarketInfo(marketId);
    console.log(`Market Outcome: ${updatedMarketInfo.outcome}`);
    console.log(`Resolved: ${updatedMarketInfo.resolved}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});