# Durianhah — Decentralized Durian Supply Chain dApp

> **"From Tree to Table, Verified on Chain."**

> Durianhah is a blockchain-based demo for durian supply-chain traceability and incentive management.
> It uses ERC-721 Solidity smart contracts deployed on Kaia Testnet to record every stage of the durian journey — from planting to retail — directly on chain.
> Through an ERC-20 reward mechanism, it incentivizes all participants to upload authentic data, preventing overpricing and information opacity.

---

## Project Overview
### Summary
This project builds a complete decentralized supply-chain framework consisting of three main modules.

| Modules | Description |
|------|------|
| **Durian721** | Each durian or batch is minted as an ERC-721 NFT, representing a unique on-chain identity. |
| **RewardToken** | An ERC-20 reward token that incentivizes Farmers, Packers, Logistics operators, and Retailers for honest submissions. |
| **SupplyChainManager** | The main logic contract handling phase submissions, verification, delayed rewards, and time-lock mechanisms. |


## Implementation

### Prerequisites

- Node.js (version 20.17.0)
- npm (version 10.8.2)
- Metamask 
- Thirdweb
- Go to [Kaia Faucet](https://www.kaia.io/faucet) and claim some test tokens yourself every 24h with Metamask wallet address.

### Installation (You only need to do it once)

1. Clone the repository:
    ```bash
    git clone https://github.com/yingzhi923/Durianhah.git
    cd Durianhah
    ```

2. Install dependencies:
    ```bash
    cd contract
    npm install
    touch .env
    ```

3. Create Thirdweb secret key:
    - Go to [Thirdweb](http://www.thirdweb.com/) and create a secret key.
    - Write down two things: **your-secret-key** and **client id**.
    - Replace `<your-secret-key>` with the actual key you created.

    ```bash
    npm run deploy -- -k <your-secret-key>
    ```

4. Configure `.env` file in the contract directory:
    ```bash
    DEPLOYER_ADDRESS="your_metamask_wallet_address"
    KAIROS_TESTNET_URL="https://public-en-kairos.node.kaia.io"
    PRIVATE_KEY="your_metamask_wallet_private_key"
    ```

5. Deploy the RewardToken contract, Durian721 contract and SupplyChainManager contract:
    ```bash
    npx hardhat run scripts/deploy.js --network kairos
    ```
    After this cmd, you will see:
    <img width="710" height="266" alt="Image" src="https://github.com/user-attachments/assets/0bcb93d3-25bc-43fd-aa05-a75c93221a3a" />

    **Please copy the addresses of these contracts and paste them into `../frontend/src/constants/contracts.ts` and `.env` file.**
    ```bash
    tokenContractAddress = "0x..."
    durianNFTContractAddress = "0x..."
    supplyChainManagerContractAddress = "0x..."
    ```

    There should be 7 entries in `.env`.
    <img width="1226" height="312" alt="Image" src="https://github.com/user-attachments/assets/31cb3be2-52fe-4b15-8625-b2d7bf1af256" />


7. Configure `.env` file in the frontend directory:
    ```bash
    cd ../frontend
    npm install
    touch .env
    ```
    Write the following into the `.env` file:
    ```bash
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID="client_id_in_thirdweb"
    THIRDWEB_SECRET_KEY="secret_key_in_thirdweb"
    KAIROS_TESTNET_URL="https://public-en-kairos.node.kaia.io"
    ```
    <img width="1287" height="354" alt="Image" src="https://github.com/user-attachments/assets/aedfea3b-17b4-4ced-835e-b80e3b16ffc4" />


### Run the development server

1. Start the development server:
    ```bash
    npm run dev
    ```

### Glimpse

tbd

