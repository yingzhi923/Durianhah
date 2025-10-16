import { client } from "@/app/client";
import { defineChain, getContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { kaiaTestnet } from "@/chain.config";

export const tokenContractAddress = "0x038307854d8429af18e2e8fB84a5d2Ff79031C8C";
export const durianNFTContractAddress = "0x08d9776F2cd5C0973B3E42b7E8f98C044FA782D4";
export const supplyChainManagerContractAddress = "0x48f474123947AE88670Dd495aaB2133277b9DD4C";

export const nftContract = getContract({
    client: client,
    // chain: base,
    address: durianNFTContractAddress,
    chain: kaiaTestnet
});

export const rewardTokenContract = getContract({
    client: client,
    // chain: base,
    address: tokenContractAddress,
    chain: kaiaTestnet
});

export const supplyChainContract = getContract({
    client: client,
    // chain: base,
    address: supplyChainManagerContractAddress,
    chain: kaiaTestnet
});

