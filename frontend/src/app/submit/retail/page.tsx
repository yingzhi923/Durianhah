"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { readContract, prepareContractCall } from "thirdweb";
import { supplyChainContract } from "@/constants/contract";
import { generateDataHash, generateMockCID, getErrorMessage } from "@/lib/helpers";

import { Header } from "@/components/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import { Loader2, Upload, CheckCircle, Shield, Store, FileCheck } from "lucide-react";

// @ts-ignore - for personal_sign encoding
import { Buffer } from "buffer";

/* ========== 工具：弹出钱包签名，营造“授权钱包”体验（与 Phase1 一致） ========== */
async function requestUserSignature(address?: string) {
  if (!address) throw new Error("Wallet not connected");
  if (!(window as any)?.ethereum) throw new Error("No EVM wallet found");
  const msg = `Durian Supply Chain — authorize Phase 5 submission
Address: ${address}
Timestamp: ${Date.now()}`;
  const hexMsg = `0x${Buffer.from(msg, "utf8").toString("hex")}`;
  const sig = await (window as any).ethereum.request({
    method: "personal_sign",
    params: [hexMsg, address],
  });
  return { msg, sig };
}



/* ========== 角色获取：优先 RETAILER_ROLE；没有则回退 FARMER_ROLE 以兼容 demo 合约 ========== */
async function getRetailRoleBytes32() {
  try {
    return (await readContract({
      contract: supplyChainContract,
      method: "function RETAILER_ROLE() view returns (bytes32)",
      params: [],
    })) as `0x${string}`;
  } catch {
    return (await readContract({
      contract: supplyChainContract,
      method: "function FARMER_ROLE() view returns (bytes32)",
      params: [],
    })) as `0x${string}`;
  }
}

/* ========== 可选：若合约有 unlockAt(tokenId, phase) 可从链上读取；否则返回 null ========== */
async function readOnchainUnlockAt(tokenId: bigint, phase: number) {
  try {
    // 如你的合约没有该函数，可忽略，这里捕获错误后会走本地倒计时
    const ts = await readContract({
      contract: supplyChainContract,
      method: "function unlockAt(uint256 tokenId, uint8 phase) view returns (uint256)",
      params: [tokenId, phase],
    });
    const ms = Number(ts) * 1000;
    return ms > 0 ? ms : null;
  } catch {
    return null;
  }
}

export default function SubmitRetail() {
  const account = useActiveAccount();
  const { mutateAsync: sendTx } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  // —— Step 5：权限 —— //
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [hasRole, setHasRole] = useState(false);

  // —— Phase 4 verification —— //
  const [verifyingPhase4, setVerifyingPhase4] = useState(false);
  const [phase4Verified, setPhase4Verified] = useState(false);

  // —— 提交 & 成功状态 —— //
  const [tokenId, setTokenId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // —— 演示延迟奖励：7 分钟（正式可改成 7 天，且应由合约强制） —— //
  const DEMO_DELAY_MS = 7 * 60 * 1000;
  const [unlockAt, setUnlockAt] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const tickRef = useRef<number | null>(null);

  // Get current date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // —— 表单（自动填充默认值，用户可修改） —— //
  const [form, setForm] = useState({
    receivedDate: getTodayDate(),
    saleDate: getTodayDate(),
    storeId: "STORE-2025-001",
    city: "Kuala Lumpur",
    unitsReceived: "50",
    unitsSold: "45",
    pricePerKg: "32.00",
    avgStoreTempC: "4.5",
    customerNotes: "Premium quality, excellent customer feedback. Durians stored in optimal conditions with regular temperature monitoring.",
    photoCid: "",
  });

  // —— 倒计时相关 —— //
  const LS_KEY = (tid: string | number, phase: number) => `durian_unlockAt_${tid}_${phase}`;
  const remainMs = unlockAt ? Math.max(0, unlockAt - nowTs) : 0;
  const canClaim = remainMs === 0 && !!unlockAt;
  const fmt = (ms: number) => {
    const sec = Math.ceil(ms / 1000);
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  useEffect(() => {
    if (unlockAt) {
      tickRef.current = window.setInterval(() => setNowTs(Date.now()), 1000);
    }
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [unlockAt]);

  // —— 静默预检查角色（不阻塞 UI） —— //
  useEffect(() => {
    (async () => {
      if (!account) {
        setHasRole(false);
        return;
      }
      try {
        const role = await getRetailRoleBytes32();
        const ok = await readContract({
          contract: supplyChainContract,
          method: "function hasRole(bytes32 role, address account) view returns (bool)",
          params: [role, account.address],
        });
        setHasRole(Boolean(ok));
      } catch {
        setHasRole(false);
      }
    })();
  }, [account?.address]);

  // —— Step 5：点击验证（先弹签名，再 hasRole 校验） —— //
  const handleVerifyPermission = async () => {
    if (!account) {
      toast({ title: "Wallet Not Connected", description: "Please connect your wallet first", variant: "destructive" });
      return;
    }
    setChecking(true);
    try {
      await requestUserSignature(account.address); // ✅ 弹出钱包签名
      const role = await getRetailRoleBytes32();
      const ok = await readContract({
        contract: supplyChainContract,
        method: "function hasRole(bytes32 role, address account) view returns (bool)",
        params: [role, account.address],
      });

      if (!ok) {
        toast({
          title: "Permission Required",
          description: "You don't have the required role yet. Go to the Roles page to grant it.",
          variant: "destructive",
        });
        setVerified(false);
        setHasRole(false);
        return;
      }

      setHasRole(true);
      setVerified(true);
      toast({ title: "Permission Verified ✅", description: "You can proceed to verify Phase 4 data." });
    } catch (err) {
      toast({
        title: "Verification Failed",
        description: getErrorMessage(err) || "Authorization/signature or role check failed.",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  // —— Verify Phase 4 (Logistics) Data —— //
  const handleVerifyPhase4 = async () => {
    if (!account) {
      toast({ title: "Wallet Not Connected", description: "Please connect your wallet first", variant: "destructive" });
      return;
    }
    if (!tokenId) {
      toast({ title: "Token ID Required", description: "Please enter the Durian Token ID first", variant: "destructive" });
      return;
    }

    setVerifyingPhase4(true);
    try {
      const tx = prepareContractCall({
        contract: supplyChainContract,
        method: "function verifyPhase(uint256 tokenId, uint8 phase)",
        params: [BigInt(tokenId), 4],
      });

      await sendTx(tx);
      setPhase4Verified(true);
      toast({
        title: "Phase 4 Verified! ✅",
        description: `Logistics data for Token #${tokenId} has been verified. You can now submit retail data.`,
        duration: 5000,
      });
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: getErrorMessage(err) || "Could not verify Phase 4 data",
        variant: "destructive",
      });
    } finally {
      setVerifyingPhase4(false);
    }
  };

  // —— 提交 Phase 5 —— //
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) {
      toast({ title: "Wallet Not Connected", description: "Please connect your wallet first", variant: "destructive" });
      return;
    }
    if (!verified) {
      toast({ title: "Not Verified", description: "Please verify permission first.", variant: "destructive" });
      return;
    }
    if (!phase4Verified) {
      toast({ title: "Phase 4 Not Verified", description: "Please verify Phase 4 (Logistics) data first.", variant: "destructive" });
      return;
    }
    if (!tokenId || !form.receivedDate || !form.saleDate || !form.unitsSold || !form.pricePerKg || !form.avgStoreTempC) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields marked with *", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        phase: 5,
        timestamp: Date.now(),
        receivedDate: form.receivedDate,
        saleDate: form.saleDate,
        storeId: form.storeId,
        city: form.city,
        unitsReceived: Number(form.unitsReceived || 0),
        unitsSold: Number(form.unitsSold),
        pricePerKg: Number(form.pricePerKg),
        avgStoreTempC: Number(form.avgStoreTempC),
        customerNotes: form.customerNotes || "",
      };

      const dataHash = generateDataHash(payload);
      const cid = form.photoCid?.trim() ? form.photoCid.trim() : generateMockCID();

      // [255........................................0]
      // | avgStoreTempC*100 << 176 | unitsSold << 96 | pricePerKg*100 |
      const packedData =
        (BigInt(Math.floor(Number(form.avgStoreTempC) * 100)) << BigInt(176)) |
        (BigInt(Math.floor(Number(form.unitsSold))) << BigInt(96)) |
        BigInt(Math.floor(Number(form.pricePerKg) * 100));

      const tx = prepareContractCall({
        contract: supplyChainContract,
        method:
          "function submitPhase(uint256 tokenId, uint8 phase, bytes32 dataHash, uint256 packedData, string calldata cid)",
        params: [BigInt(tokenId), 5, dataHash as `0x${string}`, packedData, cid],
      });

      await sendTx(tx);

      // ✅ 奖励延迟（Demo：7 分钟；正式应由合约强制，例如 unlockAt 写在链上）
      // 优先尝试从链上读取；读不到就使用本地倒计时，并写入 localStorage（刷新不丢）
      const onchainUnlock = await readOnchainUnlockAt(BigInt(tokenId), 5);
      if (onchainUnlock && onchainUnlock > Date.now()) {
        setUnlockAt(onchainUnlock);
        localStorage.setItem(LS_KEY(tokenId, 5), String(onchainUnlock));
      } else {
        const demoUnlock = Date.now() + DEMO_DELAY_MS;
        setUnlockAt(demoUnlock);
        localStorage.setItem(LS_KEY(tokenId, 5), String(demoUnlock));
      }

      setSubmitSuccess(true);
      toast({
        title: "Phase 5 Submitted Successfully! 🎉",
        description: `Retail data for Token #${tokenId} recorded. Reward will unlock after the delay.`,
        duration: 6000,
      });

      setForm({
        receivedDate: getTodayDate(),
        saleDate: getTodayDate(),
        storeId: "STORE-2025-001",
        city: "Kuala Lumpur",
        unitsReceived: "50",
        unitsSold: "45",
        pricePerKg: "32.00",
        avgStoreTempC: "4.5",
        customerNotes: "Premium quality, excellent customer feedback. Durians stored in optimal conditions with regular temperature monitoring.",
        photoCid: "",
      });
    } catch (err: any) {
      const msg = err?.message?.includes("execution reverted")
        ? "Transaction reverted. Please ensure you have the required role on this chain."
        : getErrorMessage(err);
      toast({ title: "Submission Failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // —— 领取奖励：多方法名尝试，以适配不同合约命名 —— //
  const claimRewardOnChain = async () => {
    if (!account) {
      toast({ title: "Wallet Not Connected", description: "Please connect your wallet first", variant: "destructive" });
      return;
    }
    if (!tokenId) {
      toast({ title: "Missing Token ID", description: "Token ID is required to claim reward", variant: "destructive" });
      return;
    }
    try {
      const tryMethods = [
        "function claimReward(uint256 tokenId, uint8 phase)" as const,
        "function claimPhaseReward(uint256 tokenId, uint8 phase)" as const,
        "function claim(uint256 tokenId, uint8 phase)" as const,
      ];
      let sent = false;
      for (const sig of tryMethods) {
        try {
          const tx = prepareContractCall({
            contract: supplyChainContract,
            method: sig as any,
            params: [BigInt(tokenId), 5],
          });
          await sendTx(tx);
          sent = true;
          break;
        } catch {
          // 尝试下一个签名
        }
      }
      if (!sent) throw new Error("No claim method matched on the contract.");
      toast({ title: "Reward Claimed 🎁", description: `Token #${tokenId} Phase 5 reward claimed.` });
    } catch (err: any) {
      toast({
        title: "Claim Failed",
        description: getErrorMessage(err) || "Claim method not found or not yet unlocked on-chain.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Header />
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
        </div>

        {submitSuccess ? (
          <Card className="p-8 text-center space-y-4">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-2" />
            <h2 className="text-2xl font-bold">Submission Successful!</h2>
            <p className="text-gray-600">Phase 5 (Retail) data has been recorded on-chain.</p>

            {/* 奖励倒计时 + 领取（演示 7 分钟；若合约有 unlockAt 则以链上为准） */}
            <div className="mx-auto max-w-md bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-medium text-blue-900 mb-1">Reward Unlock</p>
              {unlockAt ? (
                <>
                  {!canClaim ? (
                    <p className="text-sm text-blue-800">
                      Unlocks in <span className="font-semibold">{fmt(remainMs)}</span>
                      <span className="ml-1 text-xs opacity-80">(Demo)</span>
                    </p>
                  ) : (
                    <p className="text-sm text-blue-800 mb-2">Reward is now unlockable.</p>
                  )}
                  <Button onClick={claimRewardOnChain} disabled={!canClaim} className="w-full mt-3">
                    {canClaim ? "Claim Reward 🎁" : "Waiting to Unlock..."}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-blue-800">Unlock schedule not set.</p>
              )}
            </div>

            <div className="flex justify-center gap-4 pt-2">
              <Link href={`/durian/${tokenId}`}><Button>View Details</Button></Link>
              <Button variant="outline" onClick={() => { setSubmitSuccess(false); setUnlockAt(null); }}>
                Submit Another
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Step 5：权限卡 + 黑色整宽按钮（点击先签名再校验） */}
            <Card className="p-8 mb-6">
              <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <span className="text-4xl">🏪</span>
                  Phase 5: Retail - Step 5
                </h1>
                <p className="text-gray-600 mt-2">
                  Record retail sales and store conditions for your Durian NFT batch (Token ID from Phase 1)
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Permission Required
                </h4>
                <p className="text-sm text-orange-800 mb-2">
                  You need <span className="font-bold">RETAILER_ROLE</span> (or fallback role) to submit Retail data.
                </p>
                <p className="text-xs text-orange-700">
                  If submission fails, please go to the{" "}
                  <Link href="/roles" className="underline font-medium">Roles page</Link>{" "}
                  to grant yourself the required role.
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
                    Verifying...
                  </>
                ) : (
                  <>
                    <Store className="mr-2 h-5 w-5" />
                    Start Retail Submission
                  </>
                )}
              </Button>

              {!account && (
                <p className="text-center text-red-500 text-sm mt-2">
                  Please connect your wallet to continue
                </p>
              )}

              {verified && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <CheckCircle className="inline h-5 w-5 text-green-600 mr-2" />
                  <span className="font-medium text-green-900">Permission Verified!</span>
                  <p className="text-sm text-green-800 mt-2">
                    You can now review POS data and submit to blockchain.
                  </p>
                </div>
              )}
            </Card>

            {/* Step 2: Verify Phase 4 (Logistics) Data */}
            {verified && !phase4Verified && (
              <Card className="p-8 mb-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <FileCheck className="h-6 w-6 text-blue-600" />
                    Verify Phase 4 (Logistics) Data
                  </h2>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-900 mb-2">
                    <strong>Before submitting retail data</strong>, you must verify the logistics (Phase 4) data submitted by the logistics provider.
                  </p>
                  <p className="text-xs text-blue-800">
                    This verification step ensures data integrity and enables the logistics provider to claim their reward after the time lock period.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Durian Token ID *</label>
                    <Input 
                      type="text" 
                      inputMode="numeric"
                      placeholder="e.g., 1760..." 
                      value={tokenId} 
                      onChange={(e) => setTokenId(e.target.value.trim())} 
                    />
                  </div>

                  <Button
                    onClick={handleVerifyPhase4}
                    disabled={verifyingPhase4 || !tokenId}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white"
                    size="lg"
                  >
                    {verifyingPhase4 ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Verifying Phase 4...
                      </>
                    ) : (
                      <>
                        <FileCheck className="mr-2 h-5 w-5" />
                        Verify & Sign Logistics Data
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            )}

            {/* Phase 4 Verified Success Message */}
            {verified && phase4Verified && (
              <Card className="p-6 mb-6 bg-green-50 border-green-200">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-green-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-green-900">Phase 4 Verified!</h3>
                    <p className="text-sm text-green-800 mt-1">
                      Logistics data has been verified. You can now proceed to submit retail data below.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Step 3: Submit Form (only after Phase 4 is verified) */}
            {verified && phase4Verified && (
              <Card className="p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="text-3xl">📝</span>
                    Phase 5: Submit Retail Data
                  </h2>
                  <p className="text-gray-600 mt-2">Complete the form with retail details (auto-filled, editable)</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Durian Token ID (from Phase 1) *</label>
                    <Input type="text" inputMode="numeric" placeholder="e.g., 1760..." value={tokenId} onChange={(e) => setTokenId(e.target.value.trim())} />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Received Date (YYYY-MM-DD) *</label>
                      <Input type="date" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Sale Date (YYYY-MM-DD) *</label>
                      <Input type="date" value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Store ID / Name</label>
                      <Input type="text" placeholder="e.g., DURIAN-MALL-01" value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">City / Location</label>
                      <Input type="text" placeholder="e.g., Singapore" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Units Received</label>
                      <Input type="number" placeholder="e.g., 200" value={form.unitsReceived} onChange={(e) => setForm({ ...form, unitsReceived: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Units Sold *</label>
                      <Input type="number" placeholder="e.g., 180" value={form.unitsSold} onChange={(e) => setForm({ ...form, unitsSold: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Price per Kg (RM) *</label>
                      <Input type="number" step="0.01" placeholder="e.g., 31.50" value={form.pricePerKg} onChange={(e) => setForm({ ...form, pricePerKg: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text sm font-medium mb-2">Average Store Temp (°C) *</label>
                      <Input type="number" step="0.01" placeholder="e.g., 18.50" value={form.avgStoreTempC} onChange={(e) => setForm({ ...form, avgStoreTempC: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Customer Notes (optional)</label>
                      <Textarea rows={3} placeholder="e.g., Good aroma; high sweetness; repeat buyers." value={form.customerNotes} onChange={(e) => setForm({ ...form, customerNotes: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Photo CID (optional; leave empty to auto-generate mock CID)</label>
                    <Input type="text" placeholder="ipfs://... or CID" value={form.photoCid} onChange={(e) => setForm({ ...form, photoCid: e.target.value })} />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">📝 Submission Information</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Data will be permanently stored on the blockchain</li>
                      <li>• Rewards can be claimed after verification and unlock</li>
                      <li>• Demo unlock time: ~7 minutes (Prod: ~7 days via contract)</li>
                    </ul>
                  </div>

                  <Button type="submit" disabled={submitting || !account || !tokenId} className="w-full h-12 text-lg bg-black text-white hover:bg-black/90" size="lg">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-5 w-5" />
                        Submit to Blockchain
                      </>
                    )}
                  </Button>

                  {!account && <p className="text-center text-red-500 text-sm">Please connect your wallet to submit</p>}
                </form>
              </Card>
            )}
          </>
        )}

        {/* 其他阶段导航 */}
        <div className="mt-8">
          <h3 className="font-semibold mb-4">Other Phase Submissions</h3>
          <div className="grid md:grid-cols-4 gap-4">
            <Link href="/submit/farming">
              <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="text-2xl mb-2">🌱</div>
                <p className="font-medium">Phase 1: Farming</p>
              </Card>
            </Link>
            <Link href="/submit/harvest">
              <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="text-2xl mb-2">✂️</div>
                <p className="font-medium">Phase 2: Harvest</p>
              </Card>
            </Link>
            <Link href="/submit/packing">
              <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="text-2xl mb-2">📦</div>
                <p className="font-medium">Phase 3: Packing</p>
              </Card>
            </Link>
            <Link href="/submit/logistics">
              <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="text-2xl mb-2">🚚</div>
                <p className="font-medium">Phase 4: Logistics</p>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

