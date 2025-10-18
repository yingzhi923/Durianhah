"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Header } from "@/components/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

/* =========================
   DEMO 数据生成器
   ========================= */
const generateDemoData = () => {
  const now = Date.now() / 1000;
  
  // 模拟钱包统计数据
  const demoStats: WalletStats = {
    tokenBalance: String(250.50 * 1e18), // 250.50 TOKEN
    totalClaimed: String(180.25 * 1e18), // 180.25 TOKEN
    claimCount: 12,
    nftCount: 5,
  };

  // 模拟领取历史记录
  const demoClaims: ClaimRecord[] = [
    {
      tokenId: "1",
      phase: 5,
      amount: String(50 * 1e18),
      timestamp: now - 3600 * 2, // 2小时前
    },
    {
      tokenId: "2",
      phase: 4,
      amount: String(40 * 1e18),
      timestamp: now - 3600 * 8, // 8小时前
    },
    {
      tokenId: "1",
      phase: 4,
      amount: String(40 * 1e18),
      timestamp: now - 3600 * 24, // 1天前
    },
    {
      tokenId: "3",
      phase: 3,
      amount: String(30 * 1e18),
      timestamp: now - 3600 * 48, // 2天前
    },
    {
      tokenId: "2",
      phase: 3,
      amount: String(30 * 1e18),
      timestamp: now - 3600 * 72, // 3天前
    },
    {
      tokenId: "4",
      phase: 2,
      amount: String(20 * 1e18),
      timestamp: now - 3600 * 96, // 4天前
    },
    {
      tokenId: "1",
      phase: 3,
      amount: String(30 * 1e18),
      timestamp: now - 3600 * 120, // 5天前
    },
    {
      tokenId: "5",
      phase: 1,
      amount: String(10 * 1e18),
      timestamp: now - 3600 * 144, // 6天前
    },
    {
      tokenId: "2",
      phase: 2,
      amount: String(20 * 1e18),
      timestamp: now - 3600 * 168, // 7天前
    },
    {
      tokenId: "1",
      phase: 2,
      amount: String(20 * 1e18),
      timestamp: now - 3600 * 192, // 8天前
    },
    {
      tokenId: "3",
      phase: 1,
      amount: String(10 * 1e18),
      timestamp: now - 3600 * 216, // 9天前
    },
    {
      tokenId: "1",
      phase: 1,
      amount: String(10 * 1e18),
      timestamp: now - 3600 * 240, // 10天前
    },
  ];

  // 模拟 NFT 参与记录
  const demoNFTs: NFTParticipation[] = [
    {
      tokenId: "1",
      submittedPhases: [1, 2, 3, 4, 5],
    },
    {
      tokenId: "2",
      submittedPhases: [1, 2, 3, 4],
    },
    {
      tokenId: "3",
      submittedPhases: [1, 2, 3],
    },
    {
      tokenId: "4",
      submittedPhases: [1, 2],
    },
    {
      tokenId: "5",
      submittedPhases: [1],
    },
  ];

  return {
    stats: demoStats,
    claims: demoClaims,
    nfts: demoNFTs,
  };
};

/* ===========================================================
   页面 - 钱包查看 (DEMO 模式)
   =========================================================== */
export default function WalletPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<WalletStats>({
    tokenBalance: "0",
    totalClaimed: "0",
    claimCount: 0,
    nftCount: 0,
  });
  const [claimHistory, setClaimHistory] = useState<ClaimRecord[]>([]);
  const [nftParticipations, setNftParticipations] = useState<NFTParticipation[]>([]);

  /* -------- 自动加载 Demo 数据 -------- */
  useEffect(() => {
    loadDemoData();
  }, []);

  /* -------- 加载 Demo 数据 -------- */
  const loadDemoData = () => {
    setLoading(true);
    
    // 模拟加载延迟
    setTimeout(() => {
      const demoData = generateDemoData();
      setStats(demoData.stats);
      setClaimHistory(demoData.claims);
      setNftParticipations(demoData.nfts);
      setLoading(false);
    }, 500);
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
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium flex items-center gap-2">
              🎭 DEMO MODE
            </span>
            <Button onClick={loadDemoData} disabled={loading} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Wallet className="h-8 w-8 text-blue-600" />
            My Wallet
          </h1>
          <p className="text-gray-600 mt-2">
            View your RewardToken balance, claim history, and NFT participations (Demo Data)
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
      </div>
    </div>
  );
}
