const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("Starting to fund SupplyChainManager with RewardTokens...");

  // 替换为你的合约地址
  const REWARD_TOKEN_ADDRESS = "YOUR_REWARD_TOKEN_ADDRESS";
  const SUPPLY_CHAIN_MANAGER_ADDRESS = "YOUR_SUPPLY_CHAIN_MANAGER_ADDRESS";

  // 获取签名者
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // 连接到合约
  const RewardToken = await ethers.getContractAt("RewardToken", REWARD_TOKEN_ADDRESS);
  const SupplyChainManager = await ethers.getContractAt("SupplyChainManager", SUPPLY_CHAIN_MANAGER_ADDRESS);

  // 计算需要的总金额
  // 5 phases × 10 TOKEN per phase = 50 TOKEN per NFT
  // 假设有 10 个 NFT，需要 500 TOKEN
  // 为了安全，我们充值 1000 TOKEN
  const FUND_AMOUNT = ethers.parseEther("1000"); // 1000 TOKEN

  console.log("\n1. Checking current balances...");
  const deployerBalance = await RewardToken.balanceOf(deployer.address);
  const contractBalance = await RewardToken.balanceOf(SUPPLY_CHAIN_MANAGER_ADDRESS);
  
  console.log("Deployer balance:", ethers.formatEther(deployerBalance), "TOKEN");
  console.log("Contract balance:", ethers.formatEther(contractBalance), "TOKEN");

  if (deployerBalance < FUND_AMOUNT) {
    console.log("\n❌ Insufficient balance! Minting tokens first...");
    const mintTx = await RewardToken.mint(deployer.address, FUND_AMOUNT);
    await mintTx.wait();
    console.log("✅ Minted", ethers.formatEther(FUND_AMOUNT), "TOKEN to deployer");
  }

  console.log("\n2. Approving SupplyChainManager to spend tokens...");
  const approveTx = await RewardToken.approve(SUPPLY_CHAIN_MANAGER_ADDRESS, FUND_AMOUNT);
  await approveTx.wait();
  console.log("✅ Approval successful");

  console.log("\n3. Funding rewards to SupplyChainManager...");
  const fundTx = await SupplyChainManager.fundRewards(FUND_AMOUNT);
  await fundTx.wait();
  console.log("✅ Funded", ethers.formatEther(FUND_AMOUNT), "TOKEN to contract");

  console.log("\n4. Checking final balances...");
  const finalDeployerBalance = await RewardToken.balanceOf(deployer.address);
  const finalContractBalance = await RewardToken.balanceOf(SUPPLY_CHAIN_MANAGER_ADDRESS);
  
  console.log("Deployer balance:", ethers.formatEther(finalDeployerBalance), "TOKEN");
  console.log("Contract balance:", ethers.formatEther(finalContractBalance), "TOKEN");

  console.log("\n🎉 Funding complete! The contract can now pay rewards.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
