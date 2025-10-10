import { defineChain } from "thirdweb";

export const kaiaTestnet = defineChain({
  id: 1001, // please confirm the actual Chain ID of Kaia Kairos Testnet
  name: "Kaia Kairos Testnet",
  nativeCurrency: {
    name: "KLAY",
    symbol: "KLAY",
    decimals: 18,
  },
  // rpc: process.env.KAIROS_TESTNET_URL || "", // Kaia Testnet 的 Public RPC Endpoint
  rpc: "https://public-en-kairos.node.kaia.io",
  testnet: true,
});