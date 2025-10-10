const { ethers } = require("hardhat");

// npx hardhat run scripts/mintTokens.js --network kairos

const marketOwnerAddress = process.env.DEPLOYER_ADDRESS;
const tokenContractAddress = process.env.SWAN_TOKEN_CONTRACT_ADDRESS; // 替换成实际的 SwanToken 合约地址
const recipientAddress = "0xCA13cf0032A37f47339541700345e0ABA38F6605"; // 接收代币的地址
const mintAmount = ethers.parseUnits("1000", 18); // mint 1000 SWAN (18位小数)

async function main() {
    // 获取部署者账户（必须是合约 owner）
    const [deployer] = await ethers.getSigners();
    console.log(`Using deployer address: ${deployer.address}`);

    // 加载 SwanToken 合约
    const SwanToken = await ethers.getContractFactory("SwanToken");
    const swanToken = await SwanToken.attach(tokenContractAddress);

    // 检查合约 owner
    const owner = await swanToken.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error("Error: Deployer is not the owner of the SwanToken contract.");
        return;
    }

    console.log(`Minting ${ethers.formatUnits(mintAmount, 18)} SWAN to ${recipientAddress}...`);

    // 调用 mint 方法
    const tx = await swanToken.mint(recipientAddress, mintAmount);
    await tx.wait();

    console.log(`Successfully minted! Transaction hash: ${tx.hash}`);

    // 检查接收者余额
    const balance = await swanToken.balanceOf(recipientAddress);
    console.log(`Recipient's new SWAN balance: ${ethers.formatUnits(balance, 18)} SWAN`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});