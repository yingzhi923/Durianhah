const { ethers } = require("hardhat");

// to run the script:
//      npx hardhat run scripts/deploy.js --network kairos

async function main() {
  const deployerAddr = process.env.DEPLOYER_ADDRESS; // metamask account address
  const deployer = await ethers.getSigner(deployerAddr);

  console.log(`Deploying contracts with the account: ${deployer.address}`);
  console.log(`Account balance: ${(await deployer.provider.getBalance(deployerAddr)).toString()}\n`);

  // Step 1: 部署 RewardToken 合约
  const RewardToken = await ethers.getContractFactory("RewardToken");
  const rewardToken = await RewardToken.deploy(
    "Durian Reward Token",  // name
    "DRT",                  // symbol
    ethers.parseEther("1000000") // initial supply: 1,000,000 tokens
  );
  await rewardToken.waitForDeployment();
  const rewardTokenAddr = await rewardToken.getAddress();

  console.log(`RewardToken deployed to: ${rewardTokenAddr}`);
  console.log(`You can verify on https://kairos.kaiascope.com/account/${rewardTokenAddr} \n`);

  // Step 2: 部署 Durian721 合约
  const Durian721 = await ethers.getContractFactory("Durian721");
  const durian721 = await Durian721.deploy();
  await durian721.waitForDeployment();
  const durian721Addr = await durian721.getAddress();

  console.log(`Durian721 deployed to: ${durian721Addr}`);
  console.log(`You can verify on https://kairos.kaiascope.com/account/${durian721Addr} \n`);

  // Step 3: 部署 SupplyChainManager 合约
  const SupplyChainManager = await ethers.getContractFactory("SupplyChainManager");
  const supplyChainManager = await SupplyChainManager.deploy(
    rewardTokenAddr,  // rewardToken address
    durian721Addr     // nft address
  );
  await supplyChainManager.waitForDeployment();
  const supplyChainManagerAddr = await supplyChainManager.getAddress();

  console.log(`SupplyChainManager deployed to: ${supplyChainManagerAddr}`);
  console.log(`You can verify on https://kairos.kaiascope.com/account/${supplyChainManagerAddr} \n`);

  console.log(`Congratulations! You have just successfully deployed all the contracts!`);
  console.log(`Contract addresses:`);
  console.log(`- RewardToken: ${rewardTokenAddr}`);
  console.log(`- Durian721: ${durian721Addr}`);
  console.log(`- SupplyChainManager: ${supplyChainManagerAddr}`);
  console.log(`Please copy these addresses to your frontend configuration files.`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});