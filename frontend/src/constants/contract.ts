import { client } from "@/app/client";
import { defineChain, getContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { kaiaTestnet } from "@/chain.config";

export const tokenContractAddress = "0x8aF342553D46c02410efD570A00126E128E9eA1C";
export const durianNFTContractAddress = "0x45B939788aD88179955556c7A56ECEe22FB709e3";
export const supplyChainManagerContractAddress = "0xC0f27878abbD604dD9C62b2d6069410e3E31478f";

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

