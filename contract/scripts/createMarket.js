const { ethers } = require("hardhat");

// npx hardhat run scripts/createMarket.js --network kairos

// 地址和其他配置信息
// const marketOwnerAddress = "0x7aD4eE675f57F29dfb480F6cA5CF0a50c05E0d1e"; // 这里填入市场拥有者地址
const marketOwnerAddress = process.env.DEPLOYER_ADDRESS;
const marketContractAddress = process.env.PREDICTION_MARKET_CONTRACT_ADDRESS;

async function main() {
    // 获取部署的合约
    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
    const pmContract = await PredictionMarket.attach(marketContractAddress);

    // 通过合约创建市场
    const question = "Will humans land on Mars by 2030?";
    const optionA = "Yes";
    const optionB = "No";
    const duration = 300; // 市场持续时间为1小时 (以秒为单位)

    console.log("Creating market...");
    const tx = await pmContract.createMarket(question, optionA, optionB, duration);
    await tx.wait();

    console.log(`Market created! Transaction hash: ${tx.hash}`);

    // 获取刚刚创建的市场ID
    const marketId = await pmContract.marketCount() - 1n; 

    console.log(`Fetching details for marketId: ${marketId}`);
    
    // 调用getMarketInfo获取市场信息
    const marketInfo = await pmContract.getMarketInfo(marketId);

    console.log("Market Info:");
    console.log(`Question: ${marketInfo.question}`);
    console.log(`Option A: ${marketInfo.optionA}`);
    console.log(`Option B: ${marketInfo.optionB}`);
    console.log(`End Time: ${marketInfo.endTime}`);
    console.log(`Outcome: ${marketInfo.outcome}`);
    console.log(`Total Option A Shares: ${marketInfo.totalOptionAShares}`);
    console.log(`Total Option B Shares: ${marketInfo.totalOptionBShares}`);
    console.log(`Resolved: ${marketInfo.resolved}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});