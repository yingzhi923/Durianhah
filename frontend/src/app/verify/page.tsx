"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { readContract, prepareContractCall, getContractEvents, prepareEvent } from "thirdweb";

import { Header } from "@/components/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supplyChainContract } from "@/constants/contract";

import {
  Loader2,
  Shield,
  ShieldCheck,
  ClipboardList,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
} from "lucide-react";

/* =========================
   事件签名（实际合约定义）
   ========================= */
const PhaseSubmitted = prepareEvent({
  signature:
    "event PhaseSubmitted(uint256 indexed tokenId, uint8 indexed phase, bytes32 dataHash, uint256 packedData, string cid, address indexed submitter, uint64 submittedAt)",
});
const PhaseVerified = prepareEvent({
  signature:
    "event PhaseVerified(uint256 indexed tokenId, uint8 indexed phase, address indexed verifier, uint64 verifiedAt)",
});

/* =========================
   工具：获取角色权限检查
   合约中验证由各阶段角色执行：
   - Phase 2 由 PACKER_ROLE 验证
   - Phase 3 由 LOGISTICS_ROLE 验证
   - Phase 4 由 RETAIL_ROLE 验证
   为了简化，这里检查用户是否有任一执行角色
   ========================= */
async function checkAnyVerifierRole(address: string): Promise<boolean> {
  const roles = ["PACKER_ROLE", "LOGISTICS_ROLE", "RETAIL_ROLE"];
  
  for (const roleName of roles) {
    try {
      const roleBytes = await readContract({
        contract: supplyChainContract,
        method: `function ${roleName}() view returns (bytes32)` as any,
        params: [],
      }) as `0x${string}`;
      
      const hasRole = await readContract({
        contract: supplyChainContract,
        method: "function hasRole(bytes32 role, address account) view returns (bool)",
        params: [roleBytes, address],
      });
      
      if (hasRole) return true;
    } catch {
      continue;
    }
  }
  
  return false;
}

/* =========================
   待审核行类型
   ========================= */
type PendingRow = {
  tokenId: string;
  phase: number;
  submitter: string;
  ts: number; // seconds
};

/* ===========================================================
   页面
   =========================================================== */
export default function VerificationPage() {
  const account = useActiveAccount();
  const { mutateAsync: sendTx } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  // Step 1：权限校验
  const [checking, setChecking] = useState(false);
  const [verifiedRole, setVerifiedRole] = useState(false);

  // Step 2：待审核数据
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [search, setSearch] = useState("");

  // Step 3：审核表单
  const [selected, setSelected] = useState<{ tokenId: string; phase: number } | null>(null);
  const [decision, setDecision] = useState<"pass" | "fail">("pass");
  const [note, setNote] = useState("");

  /* -------- 静默预检查角色（仅用于 UX 提示，不弹错） -------- */
  useEffect(() => {
    (async () => {
      if (!account?.address) {
        setVerifiedRole(false);
        return;
      }
      try {
        const hasRole = await checkAnyVerifierRole(account.address);
        setVerifiedRole(hasRole);
      } catch {
        setVerifiedRole(false);
      }
    })();
  }, [account?.address]);

    /* -------- Step 1：点击"Start Verification"进行显式校验 -------- */
  const handleVerifyPermission = async () => {
    if (!account) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }
    setChecking(true);
    try {
      const hasRole = await checkAnyVerifierRole(account.address);
      if (!hasRole) {
        setVerifiedRole(false);
        toast({
          title: "Permission Required",
          description: "You need PACKER_ROLE, LOGISTICS_ROLE, or RETAIL_ROLE. Please go to Roles page to grant it.",
          variant: "destructive",
        });
        return;
      }
      setVerifiedRole(true);
      toast({
        title: "Permission Verified ✅",
        description: "You can now review and verify submissions.",
      });
      // 校验后自动拉取一次列表
      await refreshPending();
    } catch (e: any) {
      toast({
        title: "Verification Failed",
        description: e?.message || "Role check failed.",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  /* -------- 拉取待审核列表：事件兜底 --------
     思路：取所有 PhaseSubmitted，减去已有 PhaseVerified 的组合（tokenId+phase+timestamp）
     再按时间倒序，截取最近若干条。
  --------------------------------------------------- */
  const refreshPending = async () => {
    setLoading(true);
    try {
      const [subs, vers] = await Promise.all([
        getContractEvents({
          contract: supplyChainContract,
          events: [PhaseSubmitted],
          fromBlock: BigInt(0),
        }),
        getContractEvents({
          contract: supplyChainContract,
          events: [PhaseVerified],
          fromBlock: BigInt(0),
        }),
      ]);

      const verifiedKey = new Set(
        vers.map((v) => {
          const a = v.args as any;
          return `${a.tokenId}-${a.phase}`;
        })
      );

      const rows: PendingRow[] = subs
        .map((s) => {
          const a = s.args as any;
          return {
            tokenId: String(a.tokenId),
            phase: Number(a.phase),
            submitter: String(a.submitter),
            ts: Number(a.submittedAt || 0),
          };
        })
        .filter((r) => !verifiedKey.has(`${r.tokenId}-${r.phase}`))
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 50); // 只取最近 50 条，够用且快

      setPending(rows);
    } catch (e: any) {
      toast({
        title: "Load Failed",
        description: e?.message || "Cannot fetch pending items from events.",
        variant: "destructive",
      });
      setPending([]);
    } finally {
      setLoading(false);
    }
  };

  /* -------- 提交审核交易 --------
     合约方法签名：verifyPhase(uint256 tokenId, uint8 phase)
     注意：合约中验证总是"通过"，没有 fail 选项
  --------------------------------------------------- */
  const handleSubmitVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      toast({ title: "Wallet Not Connected", description: "Please connect your wallet first", variant: "destructive" });
      return;
    }
    if (!verifiedRole) {
      toast({ title: "Not Verified", description: "Please verify permission first.", variant: "destructive" });
      return;
    }
    if (!selected?.tokenId || !selected.phase) {
      toast({ title: "No Item Selected", description: "Please pick an item to verify.", variant: "destructive" });
      return;
    }

    // 如果用户选择 reject，提示无法在链上记录
    if (decision === "fail") {
      toast({
        title: "Cannot Reject On-Chain",
        description: "The current contract only supports approval. To reject, please don't verify this phase.",
        variant: "destructive",
      });
      return;
    }

    try {
      const tx = prepareContractCall({
        contract: supplyChainContract,
        method: "function verifyPhase(uint256 tokenId, uint8 phase)",
        params: [BigInt(selected.tokenId), selected.phase],
      });

      await sendTx(tx);
      toast({ 
        title: "Phase Verified! ✅", 
        description: `Token #${selected.tokenId} Phase ${selected.phase} has been verified successfully.` 
      });

      // 刷新列表 & 重置表单
      setSelected(null);
      setNote("");
      setDecision("pass");
      await refreshPending();
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err?.message || "Transaction reverted. Ensure you have the correct role for this phase.",
        variant: "destructive",
      });
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return pending;
    const s = search.trim().toLowerCase();
    return pending.filter(
      (r) =>
        r.tokenId.toLowerCase().includes(s) ||
        String(r.phase).includes(s) ||
        r.submitter.toLowerCase().includes(s)
    );
  }, [pending, search]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Header />
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div>
          <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
        </div>

        {/* Step 1：权限卡片 */}
        <Card className="p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <span className="text-4xl">✅</span>
              Data Verification - Step 1
            </h1>
            <p className="text-gray-600 mt-2">
              Verify supply chain submissions and record pass/fail results on-chain.
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h4 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permission Required
            </h4>
            <p className="text-sm text-orange-800 mb-2">
              You need one of the following roles to verify phases:
            </p>
            <ul className="text-sm text-orange-800 mb-2 ml-4 list-disc">
              <li><span className="font-bold">PACKER_ROLE</span> - to verify Phase 2 (Harvest)</li>
              <li><span className="font-bold">LOGISTICS_ROLE</span> - to verify Phase 3 (Packing)</li>
              <li><span className="font-bold">RETAIL_ROLE</span> - to verify Phase 4 (Logistics)</li>
            </ul>
            <p className="text-xs text-orange-700">
              If you don't have any role, go to the <Link href="/roles" className="underline font-medium">Roles page</Link> to grant yourself one.
            </p>
          </div>

          <Button
            onClick={handleVerifyPermission}
            disabled={checking || !account}
            className="w-full h-12 text-lg mt-6 bg-black text-white hover:bg-black/90"
            size="lg"
          >
            {checking ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Verifying Permission...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-5 w-5" />
                Start Verification
              </>
            )}
          </Button>

          {!account && (
            <p className="text-center text-red-500 text-sm mt-2">
              Please connect your wallet to continue
            </p>
          )}

          {verifiedRole && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <CheckCircle className="inline h-5 w-5 text-green-600 mr-2" />
              <span className="font-medium text-green-900">Permission Verified!</span>
              <p className="text-sm text-green-800 mt-2">
                You can now review pending items below and submit verification results.
              </p>
            </div>
          )}
        </Card>

        {/* Step 2：待审核列表（权限通过后显示） */}
        {verifiedRole && (
          <Card className="p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardList className="h-6 w-6 text-blue-600" />
                Pending Submissions
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search tokenId / phase / submitter"
                    className="pl-9 w-64"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={refreshPending} disabled={loading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Token ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Phase</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Submitter</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {!filtered.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No pending items</td>
                    </tr>
                  )}
                  {filtered.map((r) => (
                    <tr key={`${r.tokenId}-${r.phase}-${r.ts}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono border-r">#{r.tokenId}</td>
                      <td className="px-4 py-3 text-sm border-r">P{r.phase}</td>
                      <td className="px-4 py-3 text-sm border-r">{short(r.submitter)}</td>
                      <td className="px-4 py-3 text-sm border-r">{new Date(r.ts * 1000).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            setSelected({ tokenId: r.tokenId, phase: r.phase });
                            setNote("");
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Verify
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Step 3：审核提交表单（选中一行后显示） */}
        {verifiedRole && selected && (
          <Card className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-3xl">📝</span>
                Submit Verification
              </h2>
              <p className="text-gray-600 mt-2">
                Token <span className="font-mono">#{selected.tokenId}</span> · Phase <strong>P{selected.phase}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmitVerify} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> This verification page allows you to approve phases. Once verified, the submitter can claim their reward.
                </p>
                <p className="text-xs text-blue-800 mt-1">
                  The contract only supports approval verification. If you find issues, simply don't verify the phase.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Action</label>
                  <div className="h-10 px-4 py-2 bg-green-50 border border-green-200 rounded-md flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-green-900">Approve & Verify</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Verifier Address
                  </label>
                  <Input disabled value={account?.address || ""} className="font-mono text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes (optional, off-chain only)</label>
                <Textarea
                  rows={3}
                  placeholder="e.g., Verified data consistency, all quality checks passed, temperature logs reviewed."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Notes are for your reference only and won't be stored on-chain.
                </p>
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="h-11 bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Verify & Approve Phase
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => {
                    setSelected(null);
                    setNote("");
                  }}
                >
                  Cancel
                </Button>
              </div>

              {!account && (
                <p className="text-center text-red-500 text-sm mt-2">
                  Please connect your wallet to submit
                </p>
              )}
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}


function short(a: string) {
  if (!a) return "";
  return a.slice(0, 6) + "…" + a.slice(-4);
}
