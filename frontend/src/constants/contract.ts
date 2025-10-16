import { client } from "@/app/client";
import { defineChain, getContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { kaiaTestnet } from "@/chain.config";

export const tokenContractAddress = "0x8f2Bf7627Ebf500f400bfe040e23bC8D31556f92";
export const durianNFTContractAddress = "0xD0Db9396731151839ADa176EA228290Fa7A3f5ac";
export const supplyChainManagerContractAddress = "0xBb894d3BD8a6A89F31836E5A87D77a3a91f80b33";

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

