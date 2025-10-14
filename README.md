# 🍈 Durianhah — Decentralized Durian Supply Chain dApp

> **"From Tree to Table, Verified on Chain."**

> Durianhah is a blockchain-based demo for durian supply-chain traceability and incentive management.
> It uses ERC-721 Solidity smart contracts deployed on Kaia Testnet to record every stage of the durian journey — from planting to retail — directly on chain.
> Through an ERC-20 reward mechanism, it incentivizes all participants to upload authentic data, preventing overpricing and information opacity.

---

## 🧭 Project Overview
### Summary
This project builds a complete decentralized supply-chain framework consisting of three main modules.
  modules:
    - name: "🧾 Durian721"
      description: "Each durian or batch is minted as an ERC-721 NFT, representing a unique on-chain identity."
    - name: "💰 RewardToken"
      description: "An ERC-20 reward token that incentivizes Farmers, Packers, Logistics operators, and Retailers for honest submissions."
    - name: "⚙️ SupplyChainManager"
      description: "The main logic contract handling phase submissions, verification, delayed rewards, and time-lock mechanisms."

project_structure: |
  Durianhah/
  ├── contracts/
  │   ├── Durian721.sol             # NFT contract (ERC-721 + AccessControl)
  │   ├── RewardToken.sol           # ERC-20 reward token
  │   └── SupplyChainManager.sol    # Main logic contract
  ├── frontend/
  │   ├── src/
  │   │   ├── config/               # Contract addresses and ABIs
  │   │   ├── lib/                  # ethers v6 helper functions
  │   │   ├── pages/                # UI pages
  │   │   └── components/           # Reusable components
  └── README.md


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
    <img width="714" alt="image" src="https://github.com/user-attachments/assets/431323d3-59d1-419f-a8eb-ffbd1c6ae5cb" />

    **Please copy the addresses of these contracts and paste them into `../frontend/src/constants/contracts.ts` and `.env` file.**
    ```bash
    SWAN_TOKEN_CONTRACT_ADDRESS= "0x..."
    PREDICTION_MARKET_CONTRACT_ADDRESS= "0x..."
    ORACLE_CONTRACT_ADDRESS= "0x..."
    CANDIDATE_CONTRACT_ADDRESS= "0x..."
    ```

    There should be 7 entries in `.env`.
    <img width="611" alt="image" src="https://github.com/user-attachments/assets/2baf3bac-d365-4329-bfc1-8aab5c93caf1" />


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
    <img width="445" alt="image" src="https://github.com/user-attachments/assets/1f5a6e3c-d486-4af7-965f-13c061f3c775" />


### Run the development server

1. Start the development server:
    ```bash
    npm run dev
    ```


## Glimpse
<img width="1470" alt="image" src="https://github.com/user-attachments/assets/7578d0a8-898c-485c-8cae-de33313a18c9" />

<img width="1470" alt="image" src="https://github.com/user-attachments/assets/f8b7457b-4642-45cd-903c-f054bafad59a" />

<img width="1470" alt="image" src="https://github.com/user-attachments/assets/8e625389-63b5-44fb-9b82-8fc4992a1f67" />



