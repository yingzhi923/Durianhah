"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useActiveAccount,
  useSendAndConfirmTransaction,
} from "thirdweb/react";
import { readContract, prepareContractCall } from "thirdweb";
import { supplyChainContract } from "@/constants/contract";
import {
  generateDataHash,
  generateMockCID,
  getErrorMessage,
} from "@/lib/helpers";

import { Header } from "@/components/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import {
  Loader2,
  Upload,
  CheckCircle,
  Shield,
  Scissors,
} from "lucide-react";

// 有些打包器里需要，否则 personal_sign 传 hex 可能会用到 Buffer
// @ts-ignore
import { Buffer } from "buffer";

/** 统一签名：点击"Start Harvest Submission"时先弹钱包 */
async function requestUserSignature(address?: string) {
  if (!address) throw new Error("Wallet not connected");
  const msg = `Durian Supply Chain — authorize Phase 2 submission
Address: ${address}
Timestamp: ${Date.now()}`;
  const hexMsg = `0x${Buffer.from(msg, "utf8").toString("hex")}`;

  const sig = await (window as any).ethereum.request({
    method: "personal_sign",
    // 某些钱包是 [message, address]，如果遇到 Invalid params 再换顺序试试
    params: [hexMsg, address],
  });
  return { msg, sig };
}

export default function SubmitHarvest() {
  const account = useActiveAccount();
  const { mutateAsync: sendTx } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  // —— Step(现在叫 Step 2)：验证权限 —— //
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [isFarmer, setIsFarmer] = useState(false);

  // —— 表单 & 提交状态 —— //
  const [tokenId, setTokenId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [form, setForm] = useState({
    harvestDate: "",
    fruitCount: "",
    avgWeightKg: "",
    brix: "",
    qualityGrade: "A",
    defects: "",
    photoCid: "",
  });

  // 进入页面时做一次静默预检查（不弹窗）
  useEffect(() => {
    (async () => {
      if (!account) {
        setIsFarmer(false);
        return;
      }
      try {
        const role = (await readContract({
          contract: supplyChainContract,
          method: "function FARMER_ROLE() view returns (bytes32)",
          params: [],
        })) as `0x${string}`;

        const has = await readContract({
          contract: supplyChainContract,
          method:
            "function hasRole(bytes32 role, address account) view returns (bool)",
          params: [role, account.address],
        });

        setIsFarmer(Boolean(has));
      } catch {
        // 静默
        setIsFarmer(false);
      }
    })();
  }, [account?.address]);

  // Step 2 动作：先弹钱包签名，再做角色校验
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
      // ✅ 先触发钱包签名：保证“需要连接就弹钱包”的体验
      await requestUserSignature(account.address);

      const role = (await readContract({
        contract: supplyChainContract,
        method: "function FARMER_ROLE() view returns (bytes32)",
        params: [],
      })) as `0x${string}`;

      const has = await readContract({
        contract: supplyChainContract,
        method:
          "function hasRole(bytes32 role, address account) view returns (bool)",
        params: [role, account.address],
      });

      if (!has) {
        toast({
          title: "Permission Required",
          description:
            "You don't have FARMER_ROLE yet. Go to the Roles page to grant it to yourself.",
          variant: "destructive",
        });
        setVerified(false);
        setIsFarmer(false);
        return;
      }

      setIsFarmer(true);
      setVerified(true);
      toast({
        title: "Permission Verified ✅",
        description: "You have FARMER_ROLE. You can proceed to submit harvest data.",
      });
    } catch (e: any) {
      console.warn("verify failed:", e);
      toast({
        title: "Verification Failed",
        description:
          getErrorMessage(e) ||
          "Authorization/signature or role check failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  // 提交 Phase2
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }
    if (!verified) {
      toast({
        title: "Not Verified",
        description: "Please verify permission first.",
        variant: "destructive",
      });
      return;
    }
    if (
      !tokenId ||
      !form.harvestDate ||
      !form.fruitCount ||
      !form.avgWeightKg ||
      !form.brix
    ) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields marked with *",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        phase: 2,
        timestamp: Date.now(),
        harvestDate: form.harvestDate,
        fruitCount: Number(form.fruitCount),
        avgWeightKg: Number(form.avgWeightKg),
        brix: Number(form.brix),
        qualityGrade: form.qualityGrade,
        defects: form.defects || "",
      };

      const dataHash = generateDataHash(payload);
      const cid =
        form.photoCid && form.photoCid.trim() !== ""
          ? form.photoCid.trim()
          : generateMockCID();

      // 与 Phase1 风格一致的位打包
      const packedData =
        (BigInt(Math.floor(Number(form.brix) * 10)) << BigInt(176)) |
        (BigInt(Math.floor(Number(form.avgWeightKg) * 100)) << BigInt(96)) |
        BigInt(Math.floor(Number(form.fruitCount)));

      const tx = prepareContractCall({
        contract: supplyChainContract,
        method:
          "function submitPhase(uint256 tokenId, uint8 phase, bytes32 dataHash, uint256 packedData, string calldata cid)",
        params: [BigInt(tokenId), 2, dataHash as `0x${string}`, packedData, cid],
      });

      await sendTx(tx);

      setSubmitSuccess(true);
      toast({
        title: "Phase 2 Submitted Successfully! 🎉",
        description: `Harvest data for Token #${tokenId} has been recorded on-chain.`,
        duration: 5000,
      });

      // 保留 tokenId，清空表单
      setForm({
        harvestDate: "",
        fruitCount: "",
        avgWeightKg: "",
        brix: "",
        qualityGrade: "A",
        defects: "",
        photoCid: "",
      });
    } catch (err: any) {
      console.warn("harvest submit failed:", err);
      const msg = err?.message?.includes("execution reverted")
        ? "Transaction reverted. Please ensure you have FARMER_ROLE (go to Roles page)."
        : getErrorMessage(err);
      toast({ title: "Submission Failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
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
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Home
          </Link>
        </div>

        {submitSuccess ? (
          <Card className="p-8 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Submission Successful!</h2>
            <p className="text-gray-600 mb-6">
              Phase 2 (Harvest) data has been successfully submitted to the blockchain
            </p>
            <div className="flex justify-center gap-4">
              <Link href={`/durian/${tokenId}`}>
                <Button>View Details</Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => setSubmitSuccess(false)}
              >
                Submit Another
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Step 2：标题 + 橙色权限卡 + 黑色整宽按钮（点击会先弹签名） */}
            <Card className="p-8 mb-6">
              <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <span className="text-4xl">✂️</span>
                  {/* ★ 这里按你的要求改成 Step 2 */}
                  Phase 2: Harvest - Step 2
                </h1>
                <p className="text-gray-600 mt-2">
                  Link your harvest data to an existing Durian NFT (Token ID minted in Phase 1)
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Permission Required
                </h4>
                <p className="text-sm text-orange-800 mb-2">
                  You need <span className="font-bold">FARMER_ROLE</span> to submit Harvest data.
                </p>
                <p className="text-xs text-orange-700">
                  If submission fails, please go to the{" "}
                  <Link href="/roles" className="underline font-medium">
                    Roles page
                  </Link>{" "}
                  to grant yourself FARMER_ROLE first.
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
                    <Scissors className="mr-2 h-5 w-5" />
                    Start Harvest Submission
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
                    You can now review harvest data and submit to blockchain.
                  </p>
                </div>
              )}
            </Card>

            {/* 提交表单 */}
            {verified && (
              <Card className="p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="text-3xl">📝</span>
                    Phase 2: Submit Harvest Data
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Complete the form with harvest details
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Durian Token ID (from Phase 1) *
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g., 1760..."
                      value={tokenId}
                      onChange={(e) => setTokenId(e.target.value.trim())}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Harvest Date (YYYY-MM-DD) *
                      </label>
                      <Input
                        type="date"
                        value={form.harvestDate}
                        onChange={(e) => setForm({ ...form, harvestDate: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Quality Grade (A/B/C) *
                      </label>
                      <Input
                        type="text"
                        placeholder="A"
                        value={form.qualityGrade}
                        onChange={(e) =>
                          setForm({ ...form, qualityGrade: e.target.value.toUpperCase() })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Fruit Count *
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g., 1200"
                        value={form.fruitCount}
                        onChange={(e) => setForm({ ...form, fruitCount: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Avg Weight per Fruit (kg) *
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 1.85"
                        value={form.avgWeightKg}
                        onChange={(e) => setForm({ ...form, avgWeightKg: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Brix (°Bx) *
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="e.g., 15.4"
                        value={form.brix}
                        onChange={(e) => setForm({ ...form, brix: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Defects / Notes (optional)
                    </label>
                    <Textarea
                      rows={3}
                      placeholder="e.g., <2% surface blemish; no pest damage observed."
                      value={form.defects}
                      onChange={(e) => setForm({ ...form, defects: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Photo CID (optional; leave empty to auto-generate mock CID)
                    </label>
                    <Input
                      type="text"
                      placeholder="ipfs://... or CID"
                      value={form.photoCid}
                      onChange={(e) => setForm({ ...form, photoCid: e.target.value })}
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">📝 Submission Information</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Data will be permanently stored on the blockchain</li>
                      <li>• Rewards can be claimed after Phase 2 verification</li>
                    </ul>
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting || !account || !tokenId}
                    className="w-full h-12 text-lg bg-black text-white hover:bg-black/90"
                    size="lg"
                  >
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

                  {!account && (
                    <p className="text-center text-red-500 text-sm">
                      Please connect your wallet to submit
                    </p>
                  )}
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
            <Link href="/submit/retail">
              <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="text-2xl mb-2">🏪</div>
                <p className="font-medium">Phase 5: Retail</p>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


