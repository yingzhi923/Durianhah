const { ethers } = require("hardhat");

// npx hardhat run scripts/createMarket.js --network kairos

// 地址和其他配置信息
// const marketOwnerAddress = "0x7aD4eE675f57F29dfb480F6cA5CF0a50c05E0d1e"; // 这里填入市场拥有者地址
const marketOwnerAddress = process.env.DEPLOYER_ADDRESS;
const marketContractAddress = process.env.ORACLE_CONTRACT_ADDRESS;

async function main() {
    // 获取部署的合约
    const PredictionMarket = await ethers.getContractFactory("PredictionMarketCurrency");
    const pmContract = await PredictionMarket.attach(marketContractAddress);

    // 通过合约创建市场
    const assetSymbol = "ETH";
    const operator = 0; // GREATER_THAN
    const targetPrice = ethers.parseEther("1000");
    const duration = 300; // 市场持续时间为1小时 (以秒为单位)

    console.log("Creating market...");
    const tx = await pmContract.createMarket(assetSymbol, operator, targetPrice, duration);
    await tx.wait();

    console.log(`Market created! Transaction hash: ${tx.hash}`);

    // 获取刚刚创建的市场ID
    const marketId = await pmContract.marketCount() - 1n; 

    console.log(`Fetching details for marketId: ${marketId}`);
    
    // 调用getMarketInfo获取市场信息
    const marketInfo = await pmContract.getMarketInfo(marketId);

    console.log("Market Info:");
    console.log(`Asset Symbol: ${marketInfo.assetSymbol}`);
    console.log(`Operator: ${marketInfo.operator}`);
    console.log(`Target Price: ${marketInfo.targetPrice}`);
    console.log(`End Time: ${marketInfo.endTime}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});