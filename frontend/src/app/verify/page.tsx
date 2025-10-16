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
   事件签名（兜底统计使用）
   ========================= */
const PhaseSubmitted = prepareEvent({
  signature:
    "event PhaseSubmitted(uint256 indexed tokenId, uint8 indexed phase, address indexed user, uint256 timestamp)",
});
const PhaseVerified = prepareEvent({
  signature:
    "event PhaseVerified(uint256 indexed tokenId, uint8 indexed phase, address indexed verifier, bool passed, uint256 timestamp)",
});

/* =========================
   工具：获取审核角色 bytes32
   优先 VERIFIER_ROLE / INSPECTOR_ROLE；无则回退 FARMER_ROLE（demo 友好）
   ========================= */
async function getVerifierRole() {
  const tryRead = async (sig: string) =>
    (await readContract({
      contract: supplyChainContract,
      method: sig as any,
      params: [],
    })) as `0x${string}`;

  try {
    return await tryRead("function VERIFIER_ROLE() view returns (bytes32)");
  } catch {}
  try {
    return await tryRead("function INSPECTOR_ROLE() view returns (bytes32)");
  } catch {}
  // demo fallback
  return await tryRead("function FARMER_ROLE() view returns (bytes32)");
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
        const role = await getVerifierRole();
        const has = await readContract({
          contract: supplyChainContract,
          method: "function hasRole(bytes32 role, address account) view returns (bool)",
          params: [role, account.address],
        });
        setVerifiedRole(Boolean(has));
      } catch {
        setVerifiedRole(false);
      }
    })();
  }, [account?.address]);

  /* -------- Step 1：点击“Start Verification”进行显式校验 -------- */
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
      const role = await getVerifierRole();
      const has = await readContract({
        contract: supplyChainContract,
        method: "function hasRole(bytes32 role, address account) view returns (bool)",
        params: [role, account.address],
      });
      if (!has) {
        setVerifiedRole(false);
        toast({
          title: "Permission Required",
          description: "You don't have the verifier role. Please go to Roles page to grant it.",
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
          fromBlock: 0n,
        }),
        getContractEvents({
          contract: supplyChainContract,
          events: [PhaseVerified],
          fromBlock: 0n,
        }),
      ]);

      const verifiedKey = new Set(
        vers.map((v) => {
          const a = v.args as any;
          return `${a.tokenId}-${a.phase}-${a.timestamp}`;
        })
      );

      const rows: PendingRow[] = subs
        .map((s) => {
          const a = s.args as any;
          return {
            tokenId: String(a.tokenId),
            phase: Number(a.phase),
            submitter: String(a.user),
            ts: Number(a.timestamp || 0),
          };
        })
        .filter((r) => !verifiedKey.has(`${r.tokenId}-${r.phase}-${r.ts}`))
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
     优先尝试：verifyPhase(uint256 tokenId, uint8 phase, bool passed, string note)
     失败再回退：verifyPhase(uint256 tokenId, uint8 phase, bool passed)
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

    const passed = decision === "pass";
    try {
      // 尝试带 note 版本
      let tx = prepareContractCall({
        contract: supplyChainContract,
        method:
          "function verifyPhase(uint256 tokenId, uint8 phase, bool passed, string calldata note)",
        params: [BigInt(selected.tokenId), selected.phase, passed, note || ""],
      });

      await sendTx(tx);
      toast({ title: "Verification Submitted", description: `#${selected.tokenId} P${selected.phase} · ${passed ? "Pass" : "Fail"}` });

      // 刷新列表 & 重置表单
      setSelected(null);
      setNote("");
      await refreshPending();
    } catch (errWithNote: any) {
      try {
        // 回退到不带 note 的版本
        const tx2 = prepareContractCall({
          contract: supplyChainContract,
          method: "function verifyPhase(uint256 tokenId, uint8 phase, bool passed)",
          params: [BigInt(selected.tokenId), selected.phase, passed],
        });
        await sendTx(tx2);
        toast({ title: "Verification Submitted", description: `#${selected.tokenId} P${selected.phase} · ${passed ? "Pass" : "Fail"}` });
        setSelected(null);
        setNote("");
        await refreshPending();
      } catch (err: any) {
        toast({
          title: "Verification Failed",
          description: err?.message || "Transaction reverted.",
          variant: "destructive",
        });
      }
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
              You need <span className="font-bold">VERIFIER_ROLE</span> (or configured role) to verify data.
            </p>
            <p className="text-xs text-orange-700">
              If verification fails, please go to the <Link href="/roles" className="underline font-medium">Roles page</Link> to grant yourself the role.
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
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelected({ tokenId: r.tokenId, phase: r.phase });
                              setDecision("pass");
                              setNote("");
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelected({ tokenId: r.tokenId, phase: r.phase });
                              setDecision("fail");
                              setNote("");
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
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
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Decision *</label>
                  <select
                    className="w-full border rounded-md h-10 px-3 text-sm"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value as "pass" | "fail")}
                  >
                    <option value="pass">Approve (Pass)</option>
                    <option value="fail">Reject (Fail)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Verifier Address
                  </label>
                  <Input disabled value={account?.address || ""} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes (optional)</label>
                <Textarea
                  rows={3}
                  placeholder={decision === "pass" ? "e.g., Values consistent with telemetry; all checks passed." : "e.g., Inconsistent brix vs. packing; missing doc."}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="h-11">
                  {decision === "pass" ? (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Confirm Approve
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 mr-2" />
                      Confirm Reject
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => setSelected(null)}
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
