// src/app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useActiveAccount,
} from "thirdweb/react";
import { readContract } from "thirdweb";
import { supplyChainContract } from "@/constants/contract";

import { Header } from "@/components/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import {
  BarChart3,
  BarChart as BarIcon,
  CheckCircle2,
  Clock,
  Database,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

/** ========== 合约读取的可选适配（按自己合约改签名；读不到就用 mock） ========== */
const CONTRACT_READERS = {
  // 总批次数（Phase1 铸造数量）
  totalBatches: {
    sig: "function totalBatches() view returns (uint256)",
    params: [] as any[],
  },
  // 近 7 天提交数量
  last7dSubmissions: {
    sig: "function last7dSubmissionCount() view returns (uint256)",
    params: [] as any[],
  },
  // 待审核数量（全部阶段总和）
  pendingVerifications: {
    sig: "function pendingCount() view returns (uint256)",
    params: [] as any[],
  },
  // 可领取奖励（当前地址）
  claimableRewards: {
    sig: "function pendingRewards(address user) view returns (uint256)",
    params: (addr: string) => [addr],
  },
  // 各阶段数量分布 (p1..p5)
  phaseCounts: {
    sig: "function phaseCounts() view returns (uint256,uint256,uint256,uint256,uint256)",
    params: [] as any[],
  },
  // 最近活动（如日志事件），这里假设返回结构化数据；若没有就用 mock
  // 你可以改成 events 查询页
  // function latestActivities(uint256 n) view returns (tuple(uint8 phase,uint256 tokenId,address user,uint256 ts,string action)[])
};

// --------- Mock 数据（当合约不提供上述方法时使用） ----------
const mockPhaseCounts = { p1: 38, p2: 31, p3: 27, p4: 22, p5: 18 };
const mockLast14d = Array.from({ length: 14 }).map((_, i) => {
  const d = new Date(Date.now() - (13 - i) * 86400000);
  return {
    date: d.toISOString().slice(5, 10),
    submissions: Math.floor(6 + Math.random() * 10),
  };
});
const mockActivities = Array.from({ length: 10 }).map((_, i) => {
  const phases = [1, 2, 3, 4, 5] as const;
  const p = phases[Math.floor(Math.random() * phases.length)];
  const ts = new Date(Date.now() - i * 3600_000);
  return {
    phase: p,
    tokenId: 1700 + Math.floor(Math.random() * 80),
    user: `0x${(Math.random().toString(16).slice(2) + "00000000000000000000000000000000").slice(0, 40)}`,
    ts: ts.toISOString(),
    action: p === 1 ? "Minted" : "Submitted",
    status: Math.random() > 0.75 ? "Pending" : "Recorded",
  };
});

// --------- 小工具 ----------
const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "-");
const pct = (x: number, total: number) => (total ? Math.round((x / total) * 100) : 0);

// ========================== 页面 ==========================
export default function DashboardPage() {
  const account = useActiveAccount();

  const [loading, setLoading] = useState(true);
  const [totalBatches, setTotalBatches] = useState<number>(128);
  const [last7d, setLast7d] = useState<number>(86);
  const [pending, setPending] = useState<number>(7);
  const [rewards, setRewards] = useState<number>(0);

  const [phaseCounts, setPhaseCounts] = useState<{ p1: number; p2: number; p3: number; p4: number; p5: number }>(
    mockPhaseCounts
  );
  const [trend14d, setTrend14d] = useState(mockLast14d);
  const [activities, setActivities] = useState(mockActivities);

  const totalSubmissions = useMemo(
    () => phaseCounts.p1 + phaseCounts.p2 + phaseCounts.p3 + phaseCounts.p4 + phaseCounts.p5,
    [phaseCounts]
  );

  // --------- 读取合约（如果有这些函数就显示真实数据） ----------
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // total batches
        try {
          const v = await readContract({
            contract: supplyChainContract,
            method: CONTRACT_READERS.totalBatches.sig as any,
            params: CONTRACT_READERS.totalBatches.params,
          });
          setTotalBatches(Number(v));
        } catch {}

        // last 7d
        try {
          const v = await readContract({
            contract: supplyChainContract,
            method: CONTRACT_READERS.last7dSubmissions.sig as any,
            params: CONTRACT_READERS.last7dSubmissions.params,
          });
          setLast7d(Number(v));
        } catch {}

        // pending
        try {
          const v = await readContract({
            contract: supplyChainContract,
            method: CONTRACT_READERS.pendingVerifications.sig as any,
            params: CONTRACT_READERS.pendingVerifications.params,
          });
          setPending(Number(v));
        } catch {}

        // rewards (当前地址)
        if (account?.address) {
          try {
            const v = await readContract({
              contract: supplyChainContract,
              method: CONTRACT_READERS.claimableRewards.sig as any,
              params: CONTRACT_READERS.claimableRewards.params(account.address),
            });
            setRewards(Number(v));
          } catch {}
        }

        // phase counts
        try {
          const [a, b, c, d, e] = (await readContract({
            contract: supplyChainContract,
            method: CONTRACT_READERS.phaseCounts.sig as any,
            params: CONTRACT_READERS.phaseCounts.params,
          })) as [bigint, bigint, bigint, bigint, bigint];
          setPhaseCounts({ p1: Number(a), p2: Number(b), p3: Number(c), p4: Number(d), p5: Number(e) });
        } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, [account?.address]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Header />
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* 顶部标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600">View statistics, trends and pending verifications.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Wallet className="h-4 w-4" />
              {shortAddr(account?.address || "") || "Not connected"}
            </Badge>
            <Link href="/verify">
              <Button variant="outline" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                Go to Verification
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI 区 */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="text-gray-500 text-sm">Total Batches</div>
            <div className="text-3xl font-bold mt-1">{loading ? "—" : totalBatches}</div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <Database className="h-4 w-4" /> Minted in Phase 1
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-gray-500 text-sm">Submissions (7d)</div>
            <div className="text-3xl font-bold mt-1">{loading ? "—" : last7d}</div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <BarIcon className="h-4 w-4" /> Across all phases
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-gray-500 text-sm">Pending Verifications</div>
            <div className="text-3xl font-bold mt-1">{loading ? "—" : pending}</div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <Clock className="h-4 w-4" /> Awaiting approval
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-gray-500 text-sm">Claimable Rewards</div>
            <div className="text-3xl font-bold mt-1">{loading ? "—" : rewards}</div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <CheckCircle2 className="h-4 w-4" /> DRT tokens
            </div>
          </Card>
        </div>

        {/* 图表区 */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 近 14 天趋势 */}
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Submissions (Last 14 days)
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend14d}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="submissions" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 阶段占比 */}
          <Card className="p-5">
            <div className="font-semibold mb-4">Phase Distribution</div>
            <div className="space-y-3">
              {[
                ["Phase 1: Farming", phaseCounts.p1],
                ["Phase 2: Harvest", phaseCounts.p2],
                ["Phase 3: Packing", phaseCounts.p3],
                ["Phase 4: Logistics", phaseCounts.p4],
                ["Phase 5: Retail", phaseCounts.p5],
              ].map(([label, value], idx) => {
                const v = value as number;
                const percent = pct(v, totalSubmissions || 1);
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{label}</span>
                      <span className="text-gray-500">{v} • {percent}%</span>
                    </div>
                    <Progress value={percent} />
                  </div>
                );
              })}
            </div>

            <div className="h-48 mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { phase: "P1", val: phaseCounts.p1 },
                    { phase: "P2", val: phaseCounts.p2 },
                    { phase: "P3", val: phaseCounts.p3 },
                    { phase: "P4", val: phaseCounts.p4 },
                    { phase: "P5", val: phaseCounts.p5 },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="phase" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="val" fill="#34d399" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* 待审核（快速入口） */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">Pending Verifications</div>
            <Link href="/verify">
              <Button variant="outline" size="sm" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                Review Now
              </Button>
            </Link>
          </div>
          <div className="grid md:grid-cols-5 gap-3">
            {[
              { label: "Farming", phase: 1, count: Math.floor(phaseCounts.p1 * 0.1) },
              { label: "Harvest", phase: 2, count: Math.floor(phaseCounts.p2 * 0.15) },
              { label: "Packing", phase: 3, count: Math.floor(phaseCounts.p3 * 0.12) },
              { label: "Logistics", phase: 4, count: Math.floor(phaseCounts.p4 * 0.08) },
              { label: "Retail", phase: 5, count: Math.floor(phaseCounts.p5 * 0.1) },
            ].map((x, i) => (
              <Link key={i} href={`/verify?phase=${x.phase}`}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="text-sm text-gray-500">Phase {x.phase}: {x.label}</div>
                  <div className="text-2xl font-bold mt-1">{x.count}</div>
                </Card>
              </Link>
            ))}
          </div>
        </Card>

        {/* 最近活动 */}
        <Card className="p-5">
          <div className="font-semibold mb-4">Recent Activity</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">TIME</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">PHASE</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">TOKEN ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">ACTION</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">STATUS</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">USER</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {activities.map((a, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {new Date(a.ts).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm">P{a.phase}</td>
                    <td className="px-4 py-2 text-sm">#{a.tokenId}</td>
                    <td className="px-4 py-2 text-sm">{a.action}</td>
                    <td className="px-4 py-2 text-sm">
                      <Badge
                        variant={a.status === "Pending" ? "secondary" : "default"}
                        className={a.status === "Pending" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}
                      >
                        {a.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{shortAddr(a.user)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
