"use client";

import { useEffect, useMemo, useState } from "react";
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

import {
  Loader2,
  Upload,
  CheckCircle,
  Shield,
  Package,
  Database,
} from "lucide-react";

// 某些构建环境下 personal_sign 传 hex 需用到 Buffer
// @ts-ignore
import { Buffer } from "buffer";

/** 点击“Start Packing Submission”时先触发一次钱包签名 */
async function requestUserSignature(address?: string) {
  if (!address) throw new Error("Wallet not connected");
  const msg = `Durian Supply Chain — authorize Phase 3 submission
Address: ${address}
Timestamp: ${Date.now()}`;
  const hexMsg = `0x${Buffer.from(msg, "utf8").toString("hex")}`;
  const sig = await (window as any).ethereum.request({
    method: "personal_sign",
    // 大多数钱包是 [message, address]；若遇到 Invalid params 再换顺序试试
    params: [hexMsg, address],
  });
  return { msg, sig };
}

// ------- mock sample data shown AFTER permission verified -------
type BoxRow = {
  boxNo: number;
  grade: "A" | "B" | "C";
  weightKg: number;
  cold: boolean;
  sealId: string;
};
const genBoxes = (): BoxRow[] => {
  const list: BoxRow[] = [];
  for (let i = 1; i <= 10; i++) {
    const w = 12 + Math.random() * 6; // 12~18kg per box
    const grade = (["A", "B", "A", "A", "B", "C"][Math.floor(Math.random() * 6)] ||
      "A") as "A" | "B" | "C";
    const cold = Math.random() > 0.3;
    const seal = `SEAL-${1000 + i}`;
    list.push({ boxNo: i, grade, weightKg: Number(w.toFixed(2)), cold, sealId: seal });
  }
  return list;
};

export default function SubmitPacking() {
  const account = useActiveAccount();
  const { mutateAsync: sendTx } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  // Step 3: permission verification（与 Phase1 的“前置动作”同等地位）
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [isPacker, setIsPacker] = useState(false);

  // form + submit
  const [tokenId, setTokenId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [form, setForm] = useState({
    packingDate: "",
    facilityId: "",
    boxCount: "",
    avgBoxWeightKg: "",
    packagingType: "Carton", // Carton / Foam
    coldChain: "true",       // true / false
    sealBatchId: "",
    notes: "",
    photoCid: "",
  });

  // data area shown after verified
  const [boxes] = useState<BoxRow[]>(genBoxes());
  const totalWeight = useMemo(() => {
    if (!boxes.length) return "—";
    return boxes.reduce((s, b) => s + b.weightKg, 0).toFixed(2) + " kg";
  }, [boxes]);
  const avgBoxWeight = useMemo(() => {
    if (!boxes.length) return "—";
    return (boxes.reduce((s, b) => s + b.weightKg, 0) / boxes.length).toFixed(2) + " kg";
  }, [boxes]);

  // 进入页面/地址变更时静默预检 PACKER_ROLE（不弹窗）
  useEffect(() => {
    (async () => {
      if (!account) {
        setIsPacker(false);
        return;
      }
      try {
        const role = (await readContract({
          contract: supplyChainContract,
          method: "function PACKER_ROLE() view returns (bytes32)",
          params: [],
        })) as `0x${string}`;

        const has = await readContract({
          contract: supplyChainContract,
          method: "function hasRole(bytes32 role, address account) view returns (bool)",
          params: [role, account.address],
        });

        setIsPacker(Boolean(has));
      } catch {
        // 若你的合约 demo 只用 FARMER_ROLE，这里可改 FARMER_ROLE()
        setIsPacker(false);
      }
    })();
  }, [account?.address]);

  // 点击按钮：先签名 -> 再校验 hasRole
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
      // ✅ 先弹一次钱包签名
      await requestUserSignature(account.address);

      const role = (await readContract({
        contract: supplyChainContract,
        method: "function PACKER_ROLE() view returns (bytes32)",
        params: [],
      })) as `0x${string}`;

      const has = await readContract({
        contract: supplyChainContract,
        method: "function hasRole(bytes32 role, address account) view returns (bool)",
        params: [role, account.address],
      });

      if (!has) {
        toast({
          title: "Permission Required",
          description:
            "You don't have PACKER_ROLE yet. Go to the Roles page to grant it.",
          variant: "destructive",
        });
        setVerified(false);
        setIsPacker(false);
        return;
      }
      setIsPacker(true);
      setVerified(true);
      toast({
        title: "Permission Verified ✅",
        description: "You have PACKER_ROLE. You can proceed to submit packing data.",
      });
    } catch (e: any) {
      toast({
        title: "Verification Failed",
        description:
          getErrorMessage(e) ||
          "Authorization/signature or role check failed. Please try again.",
        variant: "destructive",
      });
      console.warn(e);
    } finally {
      setChecking(false);
    }
  };

  // submit phase=3
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
      !form.packingDate ||
      !form.boxCount ||
      !form.avgBoxWeightKg ||
      !form.packagingType
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
        phase: 3,
        timestamp: Date.now(),
        packingDate: form.packingDate,
        facilityId: form.facilityId,
        boxCount: Number(form.boxCount),
        avgBoxWeightKg: Number(form.avgBoxWeightKg),
        packagingType: form.packagingType,
        coldChain: form.coldChain === "true",
        sealBatchId: form.sealBatchId,
        notes: form.notes || "",
      };

      const dataHash = generateDataHash(payload);
      const cid =
        form.photoCid && form.photoCid.trim() !== ""
          ? form.photoCid.trim()
          : generateMockCID();

      /**
       * Pack numbers:
       * [255........................................0]
       * | avgBoxWeightKg*100 << 176 | boxCount << 96 | coldChain(0/1) |
       */
      const packedData =
        (BigInt(Math.floor(Number(form.avgBoxWeightKg) * 100)) << BigInt(176)) |
        (BigInt(Math.floor(Number(form.boxCount))) << BigInt(96)) |
        BigInt(form.coldChain === "true" ? 1 : 0);

      const tx = prepareContractCall({
        contract: supplyChainContract,
        method:
          "function submitPhase(uint256 tokenId, uint8 phase, bytes32 dataHash, uint256 packedData, string calldata cid)",
        params: [BigInt(tokenId), 3, dataHash as `0x${string}`, packedData, cid],
      });

      await sendTx(tx);

      setSubmitSuccess(true);
      toast({
        title: "Phase 3 Submitted Successfully! 🎉",
        description: `Packing data for Token #${tokenId} has been recorded on-chain.`,
        duration: 5000,
      });

      setForm({
        packingDate: "",
        facilityId: "",
        boxCount: "",
        avgBoxWeightKg: "",
        packagingType: "Carton",
        coldChain: "true",
        sealBatchId: "",
        notes: "",
        photoCid: "",
      });
    } catch (err: any) {
      console.warn(err);
      const msg = err?.message?.includes("execution reverted")
        ? "Transaction reverted. Please ensure you have PACKER_ROLE (or configured role) on this chain."
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
              Phase 3 (Packing) data has been successfully submitted to the blockchain
            </p>
            <div className="flex justify-center gap-4">
              <Link href={`/durian/${tokenId}`}>
                <Button>View Details</Button>
              </Link>
              <Button variant="outline" onClick={() => setSubmitSuccess(false)}>
                Submit Another
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Step 3：标题 + 权限卡 + 黑色按钮（点击先签名再校验） */}
            <Card className="p-8 mb-6">
              <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <span className="text-4xl">📦</span>
                  {/* ★ 改成 Step 3 */}
                  Phase 3: Packing - Step 3
                </h1>
                <p className="text-gray-600 mt-2">
                  Record packing information for your Durian NFT batch (Token ID from Phase 1)
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Permission Required
                </h4>
                <p className="text-sm text-orange-800 mb-2">
                  You need <span className="font-bold">PACKER_ROLE</span> to submit Packing data.
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
                    <Package className="mr-2 h-5 w-5" />
                    Start Packing Submission
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
                    You can now review packing data and submit to blockchain.
                  </p>
                </div>
              )}
            </Card>

            {/* Step 4：数据区（通过后显示） */}
            {verified && (
              <Card className="p-8 mb-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Database className="h-6 w-6 text-blue-600" />
                    Packing Overview (10 Boxes)
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Authorized preview of planned boxes, weights and cold-chain status
                  </p>
                </div>

                <div className="mt-4 grid md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Total Weight</p>
                    <p className="text-2xl font-bold text-blue-600">{totalWeight}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Average Box Weight</p>
                    <p className="text-2xl font-bold text-blue-600">{avgBoxWeight}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Cold-chain Ratio</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {boxes.length
                        ? Math.round(
                            (boxes.filter((b) => b.cold).length / boxes.length) * 100
                          ) + "%"
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="min-w-full divide-y divide-gray-200 border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">BOX#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">GRADE</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">WEIGHT (KG)</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">COLD-CHAIN</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SEAL ID</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {boxes.map((b) => (
                        <tr key={b.boxNo} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r">{b.boxNo}</td>
                          <td className="px-4 py-3 text-sm border-r">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                b.grade === "A"
                                  ? "bg-green-100 text-green-800"
                                  : b.grade === "B"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {b.grade}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 border-r">{b.weightKg.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 border-r">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                b.cold ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {b.cold ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{b.sealId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Step 5：提交表单（版式同前） */}
            {verified && (
              <Card className="p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="text-3xl">📝</span>
                    Phase 3: Submit Packing Data
                  </h2>
                  <p className="text-gray-600 mt-2">Complete the form with packing details</p>
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
                        Packing Date (YYYY-MM-DD) *
                      </label>
                      <Input
                        type="date"
                        value={form.packingDate}
                        onChange={(e) => setForm({ ...form, packingDate: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Facility ID / Name
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g., FAC-001"
                        value={form.facilityId}
                        onChange={(e) => setForm({ ...form, facilityId: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Box Count *
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g., 120"
                        value={form.boxCount}
                        onChange={(e) => setForm({ ...form, boxCount: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Avg Box Weight (kg) *
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 15.50"
                        value={form.avgBoxWeightKg}
                        onChange={(e) => setForm({ ...form, avgBoxWeightKg: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Cold-chain Enabled *
                      </label>
                      <select
                        className="w-full border rounded-md h-10 px-3 text-sm"
                        value={form.coldChain}
                        onChange={(e) => setForm({ ...form, coldChain: e.target.value })}
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Packaging Type *
                      </label>
                      <Input
                        type="text"
                        placeholder="Carton / Foam"
                        value={form.packagingType}
                        onChange={(e) => setForm({ ...form, packagingType: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Seal Batch ID
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g., SEAL-BATCH-2025-10"
                        value={form.sealBatchId}
                        onChange={(e) => setForm({ ...form, sealBatchId: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Notes (optional)
                    </label>
                    <Textarea
                      rows={3}
                      placeholder="e.g., Packed using food-grade liners; pallets heat-treated."
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                      <li>• Rewards can be claimed after verification</li>
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

        {/* other phase nav (same look) */}
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

