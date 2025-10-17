import { client } from "@/app/client";
import { defineChain, getContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { kaiaTestnet } from "@/chain.config";

export const tokenContractAddress = "0x4A7d3FF9C0a55700FCe0546e7dF3fe12FE5c3648";
export const durianNFTContractAddress = "0x302232D5D709048c01AC01817Da404C045e8BEd0";
export const supplyChainManagerContractAddress = "0x23f54750dC3F2d0398d2285d0CDc533Ab4cB619f";

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

