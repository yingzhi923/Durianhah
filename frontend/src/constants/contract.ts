import { client } from "@/app/client";
import { defineChain, getContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { kaiaTestnet } from "@/chain.config";

export const tokenContractAddress = "0x9CEcFdC69402Fd3aA21648A684fcbd771F89Ce2D";
export const durianNFTContractAddress = "0xDBa26c2DdbCB44ef4Be4ea8B20709Be2C2c47Da8";
export const supplyChainManagerContractAddress = "0x27222DDAc10B470235784591F8Ba24FbeF9B394E";

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

