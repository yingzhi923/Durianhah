// src/app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useActiveAccount,
} from "thirdweb/react";

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

type ActivityRecord = {
  phase: number;
  tokenId: number;
  user: string;
  ts: string;
  action: string;
  status: string;
};

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

  const [phaseCounts, setPhaseCounts] = useState<{ p1: number; p2: number; p3: number; p4: number; p5: number }>({
    p1: 0,
    p2: 0,
    p3: 0,
    p4: 0,
    p5: 0,
  });
  const [pendingByPhase, setPendingByPhase] = useState<{ p1: number; p2: number; p3: number; p4: number; p5: number }>({
    p1: 0,
    p2: 0,
    p3: 0,
    p4: 0,
    p5: 0,
  });
  const [trend14d, setTrend14d] = useState<{ date: string; submissions: number }[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);

  const totalSubmissions = useMemo(
    () => phaseCounts.p1 + phaseCounts.p2 + phaseCounts.p3 + phaseCounts.p4 + phaseCounts.p5,
    [phaseCounts]
  );

  // --------- 🎭 使用 Mock 数据（Demo 版本）----------
  useEffect(() => {
    (async () => {
      setLoading(true);
      
      // 模拟加载延迟
      await new Promise(resolve => setTimeout(resolve, 800));

      try {
        // Mock 数据
        const now = Date.now();
        
        // 1. 模拟 NFT 总数
        setTotalBatches(128);
        
        // 2. 模拟各阶段数量
        const mockPhaseMap = { 
          p1: 128,  // Phase 1: Farming
          p2: 95,   // Phase 2: Harvest
          p3: 78,   // Phase 3: Packing
          p4: 62,   // Phase 4: Logistics
          p5: 45    // Phase 5: Retail
        };
        setPhaseCounts(mockPhaseMap);
        
        // 3. 模拟近 7 天提交数量
        setLast7d(86);
        
        // 4. 模拟待审核数量
        setPending(12);
        
        // 5. 模拟各阶段待审核数量
        const mockPendingMap = { 
          p1: 0,    // Phase 1 自动验证
          p2: 3,    // Phase 2 待审核
          p3: 4,    // Phase 3 待审核
          p4: 2,    // Phase 4 待审核
          p5: 3     // Phase 5 待审核（等待时间锁）
        };
        setPendingByPhase(mockPendingMap);
        
        // 6. 模拟用户奖励
        setRewards(250.50);
        
        // 7. 生成近 14 天趋势（模拟数据）
        const mockTrend = Array.from({ length: 14 }).map((_, i) => {
          const d = new Date(now - (13 - i) * 86400000);
          // 模拟每天的提交量（5-15 之间随机）
          const baseCount = 8;
          const variance = Math.floor(Math.random() * 7) - 3;
          const submissions = Math.max(3, baseCount + variance + (i % 3));
          
          return {
            date: d.toISOString().slice(5, 10),
            submissions,
          };
        });
        setTrend14d(mockTrend);
        
        // 8. 生成最近活动记录（模拟数据）
        const mockActivities: ActivityRecord[] = [
          {
            phase: 5,
            tokenId: 12845,
            user: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
            ts: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
            action: "Submitted",
            status: "Pending",
          },
          {
            phase: 4,
            tokenId: 12844,
            user: "0xABCdef123456789ABCdef123456789ABCdef1234",
            ts: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
            action: "Submitted",
            status: "Verified",
          },
          {
            phase: 3,
            tokenId: 12843,
            user: "0x123456789ABCdef123456789ABCdef123456789A",
            ts: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
            action: "Submitted",
            status: "Pending",
          },
          {
            phase: 2,
            tokenId: 12842,
            user: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
            ts: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
            action: "Submitted",
            status: "Verified",
          },
          {
            phase: 1,
            tokenId: 12841,
            user: "0xDEFabc987654321DEFabc987654321DEFabc9876",
            ts: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
            action: "Minted",
            status: "Verified",
          },
          {
            phase: 5,
            tokenId: 12840,
            user: "0x987654321ABCdef987654321ABCdef987654321A",
            ts: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
            action: "Submitted",
            status: "Verified",
          },
          {
            phase: 4,
            tokenId: 12839,
            user: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
            ts: new Date(now - 18 * 60 * 60 * 1000).toISOString(),
            action: "Submitted",
            status: "Pending",
          },
          {
            phase: 3,
            tokenId: 12838,
            user: "0xFEDcba098765432FEDcba098765432FEDcba0987",
            ts: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
            action: "Submitted",
            status: "Verified",
          },
          {
            phase: 2,
            tokenId: 12837,
            user: "0x135792468ACEbdf135792468ACEbdf135792468A",
            ts: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
            action: "Submitted",
            status: "Pending",
          },
          {
            phase: 1,
            tokenId: 12836,
            user: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
            ts: new Date(now - 36 * 60 * 60 * 1000).toISOString(),
            action: "Minted",
            status: "Verified",
          },
        ];
        setActivities(mockActivities);
        
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
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
            <h1 className="text-3xl font-bold flex items-center gap-3">
              Dashboard
              <span className="text-sm font-normal bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full">
                🎭 DEMO MODE
              </span>
            </h1>
            <p className="text-gray-600">Demo version: View simulated statistics, trends and pending verifications.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Wallet className="h-4 w-4" />
              {shortAddr(account?.address || "") || "Not connected"}
            </Badge>
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
            <div className="text-3xl font-bold mt-1">{loading ? "—" : rewards.toFixed(2)}</div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <CheckCircle2 className="h-4 w-4" /> TOKEN balance
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

        {/* 待审核统计 */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">Pending Verifications</div>
          </div>
          <div className="grid md:grid-cols-5 gap-3">
            {[
              { label: "Farming", phase: 1, count: pendingByPhase.p1 },
              { label: "Harvest", phase: 2, count: pendingByPhase.p2 },
              { label: "Packing", phase: 3, count: pendingByPhase.p3 },
              { label: "Logistics", phase: 4, count: pendingByPhase.p4 },
              { label: "Retail", phase: 5, count: pendingByPhase.p5 },
            ].map((x, i) => (
              <Card key={i} className="p-4">
                <div className="text-sm text-gray-500">Phase {x.phase}: {x.label}</div>
                <div className="text-2xl font-bold mt-1">{loading ? "—" : x.count}</div>
              </Card>
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
