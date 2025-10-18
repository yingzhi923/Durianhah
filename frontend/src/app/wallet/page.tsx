"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { readContract, getContractEvents, prepareEvent } from "thirdweb";

import { Header } from "@/components/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supplyChainContract, rewardTokenContract, nftContract } from "@/constants/contract";

import {
  Wallet,
  Coins,
  Gift,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Clock,
  CheckCircle,
  Package,
} from "lucide-react";

/* =========================
   事件签名
   ========================= */
const RewardClaimed = prepareEvent({
  signature:
    "event RewardClaimed(uint256 indexed tokenId, uint8 indexed phase, address indexed claimant, uint256 amount)",
});

const PhaseSubmitted = prepareEvent({
  signature:
    "event PhaseSubmitted(uint256 indexed tokenId, uint8 indexed phase, bytes32 dataHash, uint256 packedData, string cid, address indexed submitter, uint64 submittedAt)",
});

/* =========================
   类型定义
   ========================= */
type ClaimRecord = {
  tokenId: string;
  phase: number;
  amount: string;
  timestamp: number;
};

type NFTParticipation = {
  tokenId: string;
  submittedPhases: number[];
};

type WalletStats = {
  tokenBalance: string;
  totalClaimed: string;
  claimCount: number;
  nftCount: number;
};

/* ===========================================================
   页面 - 钱包查看
   =========================================================== */
export default function WalletPage() {
  const account = useActiveAccount();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<WalletStats>({
    tokenBalance: "0",
    totalClaimed: "0",
    claimCount: 0,
    nftCount: 0,
  });
  const [claimHistory, setClaimHistory] = useState<ClaimRecord[]>([]);
  const [nftParticipations, setNftParticipations] = useState<NFTParticipation[]>([]);

  /* -------- 自动加载钱包数据 -------- */
  useEffect(() => {
    if (account?.address) {
      loadWalletData();
    }
  }, [account?.address]);

  /* -------- 加载钱包数据 -------- */
  const loadWalletData = async () => {
    if (!account?.address) return;
    
    setLoading(true);
    try {
      // 1. 获取 RewardToken 余额
      const balance = await readContract({
        contract: rewardTokenContract,
        method: "function balanceOf(address account) view returns (uint256)",
        params: [account.address],
      });

      // 2. 获取领取记录（从事件）
      const claimEvents = await getContractEvents({
        contract: supplyChainContract,
        events: [RewardClaimed],
        fromBlock: BigInt(0),
      });

      const userClaims = claimEvents
        .filter((e: any) => e.args.claimant.toLowerCase() === account.address.toLowerCase())
        .map((e: any) => ({
          tokenId: String(e.args.tokenId),
          phase: Number(e.args.phase),
          amount: String(e.args.amount),
          timestamp: e.blockNumber ? Number(e.blockNumber) : Date.now() / 1000,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      // 3. 计算总领取金额
      const totalClaimed = userClaims.reduce(
        (sum, claim) => sum + BigInt(claim.amount),
        BigInt(0)
      );

      // 4. 获取用户参与的 NFT（通过 PhaseSubmitted 事件）
      const submitEvents = await getContractEvents({
        contract: supplyChainContract,
        events: [PhaseSubmitted],
        fromBlock: BigInt(0),
      });

      const userSubmissions = submitEvents
        .filter((e: any) => e.args.submitter.toLowerCase() === account.address.toLowerCase())
        .map((e: any) => ({
          tokenId: String(e.args.tokenId),
          phase: Number(e.args.phase),
        }));

      // 按 tokenId 分组
      const nftMap = new Map<string, number[]>();
      userSubmissions.forEach((sub) => {
        const phases = nftMap.get(sub.tokenId) || [];
        if (!phases.includes(sub.phase)) {
          phases.push(sub.phase);
        }
        nftMap.set(sub.tokenId, phases.sort((a, b) => a - b));
      });

      const nftList: NFTParticipation[] = Array.from(nftMap.entries()).map(
        ([tokenId, phases]) => ({
          tokenId,
          submittedPhases: phases,
        })
      );

      setStats({
        tokenBalance: String(balance),
        totalClaimed: String(totalClaimed),
        claimCount: userClaims.length,
        nftCount: nftList.length,
      });
      setClaimHistory(userClaims);
      setNftParticipations(nftList);
    } catch (e: any) {
      console.error("Failed to load wallet data:", e);
      toast({
        title: "Load Failed",
        description: e?.message || "Cannot fetch wallet data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Header />
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
          <Button onClick={loadWalletData} disabled={loading || !account} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {!account ? (
          <Card className="p-12 text-center">
            <Wallet className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-600">
              Please connect your wallet to view your balance and transaction history
            </p>
          </Card>
        ) : (
          <>
            {/* 页面标题 */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Wallet className="h-8 w-8 text-blue-600" />
                My Wallet
              </h1>
              <p className="text-gray-600 mt-2">
                View your RewardToken balance, claim history, and NFT participations
              </p>
            </div>

            {/* 统计卡片 */}
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <Coins className="h-8 w-8 text-green-600" />
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-sm text-green-700 mb-1">Token Balance</div>
                <div className="text-2xl font-bold text-green-900">
                  {(Number(stats.tokenBalance) / 1e18).toFixed(2)}
                </div>
                <div className="text-xs text-green-600 mt-1">TOKEN</div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <Gift className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-sm text-blue-700 mb-1">Total Claimed</div>
                <div className="text-2xl font-bold text-blue-900">
                  {(Number(stats.totalClaimed) / 1e18).toFixed(2)}
                </div>
                <div className="text-xs text-blue-600 mt-1">TOKEN</div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <CheckCircle className="h-8 w-8 text-purple-600" />
                </div>
                <div className="text-sm text-purple-700 mb-1">Claim Count</div>
                <div className="text-2xl font-bold text-purple-900">{stats.claimCount}</div>
                <div className="text-xs text-purple-600 mt-1">transactions</div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <div className="flex items-center justify-between mb-3">
                  <Package className="h-8 w-8 text-orange-600" />
                </div>
                <div className="text-sm text-orange-700 mb-1">NFT Participations</div>
                <div className="text-2xl font-bold text-orange-900">{stats.nftCount}</div>
                <div className="text-xs text-orange-600 mt-1">durians</div>
              </Card>
            </div>

            {/* 领取历史记录 */}
            <Card className="p-6">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Clock className="h-6 w-6 text-blue-600" />
                Claim History
              </h2>
              {claimHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Gift className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <p>No claims yet</p>
                  <p className="text-sm mt-1">Complete phases and claim rewards to see your history</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phase</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">View</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {claimHistory.map((claim, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono">#{claim.tokenId}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              Phase {claim.phase}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-600">
                            +{(Number(claim.amount) / 1e18).toFixed(2)} TOKEN
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(claim.timestamp * 1000).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Link href={`/durian/${claim.tokenId}`}>
                              <Button size="sm" variant="outline">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View NFT
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* NFT 参与记录 */}
            <Card className="p-6">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Package className="h-6 w-6 text-orange-600" />
                My NFT Participations
              </h2>
              {nftParticipations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <p>No participations yet</p>
                  <p className="text-sm mt-1">Submit phase data to participate in durian supply chain</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nftParticipations.map((nft) => (
                    <Link key={nft.tokenId} href={`/durian/${nft.tokenId}`}>
                      <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-300">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="text-sm text-gray-500">Durian NFT</div>
                            <div className="text-lg font-bold font-mono">#{nft.tokenId}</div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {nft.submittedPhases.map((phase) => (
                            <span
                              key={phase}
                              className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"
                            >
                              P{phase}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 text-xs text-gray-500">
                          Participated in {nft.submittedPhases.length} phase{nft.submittedPhases.length > 1 ? "s" : ""}
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
