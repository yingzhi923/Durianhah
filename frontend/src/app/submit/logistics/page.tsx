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

import { Loader2, Upload, CheckCircle, Shield, Truck, Database } from "lucide-react";

// 某些构建环境下 personal_sign 传 hex 需用到 Buffer
// @ts-ignore
import { Buffer } from "buffer";

/** 先弹一次钱包签名（与 Phase1 交互一致） */
async function requestUserSignature(address?: string) {
  if (!address) throw new Error("Wallet not connected");
  const msg = `Durian Supply Chain — authorize Phase 4 submission
Address: ${address}
Timestamp: ${Date.now()}`;
  const hexMsg = `0x${Buffer.from(msg, "utf8").toString("hex")}`;
  const sig = await (window as any).ethereum.request({
    method: "personal_sign",
    // 大多数钱包是 [message, address]；若遇到 Invalid params 可交换顺序再试
    params: [hexMsg, address],
  });
  return { msg, sig };
}

// ---------------- Mock logistics telemetry（授权后展示用） ----------------
type TelemetryRow = {
  idx: number;
  time: string;      // HH:mm
  tempC: number;     // °C
  humidity: number;  // %
  gps: string;       // lat,lon
  breach: boolean;   // 冷链告警
};
const genTelemetry = (): TelemetryRow[] => {
  const rows: TelemetryRow[] = [];
  const base = new Date();
  base.setHours(8, 0, 0, 0);
  for (let i = 0; i < 12; i++) {
    const t = new Date(base.getTime() + i * 60 * 60 * 1000);
    const temp = 4 + Math.random() * 4; // 4~8℃
    const hum = 70 + Math.random() * 10;
    const lat = (3.52 + Math.random() * 0.1).toFixed(3);
    const lon = (102.43 + Math.random() * 0.1).toFixed(3);
    rows.push({
      idx: i + 1,
      time: t.toTimeString().slice(0, 5),
      tempC: Number(temp.toFixed(1)),
      humidity: Number(hum.toFixed(0)),
      gps: `${lat},${lon}`,
      breach: Math.random() > 0.93,
    });
  }
  return rows;
};

export default function SubmitLogistics() {
  const account = useActiveAccount();
  const { mutateAsync: sendTx } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  // —— 权限校验状态 —— //
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [hasRole, setHasRole] = useState(false);

  // —— 表单 —— //
  const [tokenId, setTokenId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [form, setForm] = useState({
    dispatchDate: "",
    arrivalDate: "",
    carrier: "",
    vehicleId: "",
    origin: "",
    destination: "",
    hoursInTransit: "",
    avgTransitTempC: "",
    coldChainBreaches: "",
    notes: "",
    docCid: "",
  });

  // —— 授权后展示的数据区 —— //
  const [telemetry] = useState<TelemetryRow[]>(genTelemetry());
  const avgTemp = useMemo(
    () =>
      telemetry.length
        ? (telemetry.reduce((s, r) => s + r.tempC, 0) / telemetry.length).toFixed(1)
        : "—",
    [telemetry]
  );
  const breachCount = useMemo(
    () => telemetry.filter((r) => r.breach).length,
    [telemetry]
  );

  // 进入页面做一次静默预检查
  useEffect(() => {
    (async () => {
      if (!account) {
        setHasRole(false);
        return;
      }
      try {
        const role = (await readContract({
          contract: supplyChainContract,
          method: "function LOGISTICS_ROLE() view returns (bytes32)",
          params: [],
        })) as `0x${string}`;
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
      // ✅ 钱包先签一次名（强制弹窗授权）
      await requestUserSignature(account.address);

      const role = (await readContract({
        contract: supplyChainContract,
        method: "function LOGISTICS_ROLE() view returns (bytes32)",
        params: [],
      })) as `0x${string}`;
      const ok = await readContract({
        contract: supplyChainContract,
        method: "function hasRole(bytes32 role, address account) view returns (bool)",
        params: [role, account.address],
      });

      if (!ok) {
        toast({
          title: "Permission Required",
          description: "You don't have LOGISTICS_ROLE yet. Go to the Roles page to grant it.",
          variant: "destructive",
        });
        setVerified(false);
        setHasRole(false);
        return;
      }
      setHasRole(true);
      setVerified(true);
      toast({
        title: "Permission Verified ✅",
        description: "You have LOGISTICS_ROLE. You can proceed to submit logistics data.",
      });
    } catch (e: any) {
      toast({
        title: "Verification Failed",
        description: getErrorMessage(e) || "Authorization/signature or role check failed.",
        variant: "destructive",
      });
      console.error(e);
    } finally {
      setChecking(false);
    }
  };

  // 提交 Phase 4
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
    if (!tokenId || !form.dispatchDate || !form.arrivalDate || !form.hoursInTransit || !form.avgTransitTempC) {
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
        phase: 4,
        timestamp: Date.now(),
        dispatchDate: form.dispatchDate,
        arrivalDate: form.arrivalDate,
        carrier: form.carrier,
        vehicleId: form.vehicleId,
        origin: form.origin,
        destination: form.destination,
        hoursInTransit: Number(form.hoursInTransit),
        avgTransitTempC: Number(form.avgTransitTempC),
        coldChainBreaches: Number(form.coldChainBreaches || 0),
        notes: form.notes || "",
      };
      const dataHash = generateDataHash(payload);
      const cid = form.docCid?.trim() ? form.docCid.trim() : generateMockCID();

      // 与前面页面一致的 packedData 风格
      const packedData =
        (BigInt(Math.floor(Number(form.avgTransitTempC) * 100)) << BigInt(176)) |
        (BigInt(Math.floor(Number(form.hoursInTransit))) << BigInt(96)) |
        BigInt(Math.floor(Number(form.coldChainBreaches || 0)));

      const tx = prepareContractCall({
        contract: supplyChainContract,
        method:
          "function submitPhase(uint256 tokenId, uint8 phase, bytes32 dataHash, uint256 packedData, string calldata cid)",
        params: [BigInt(tokenId), 4, dataHash as `0x${string}`, packedData, cid],
      });

      await sendTx(tx);

      setSubmitSuccess(true);
      toast({
        title: "Phase 4 Submitted Successfully! 🎉",
        description: `Logistics data for Token #${tokenId} has been recorded on-chain.`,
        duration: 5000,
      });

      setForm({
        dispatchDate: "",
        arrivalDate: "",
        carrier: "",
        vehicleId: "",
        origin: "",
        destination: "",
        hoursInTransit: "",
        avgTransitTempC: "",
        coldChainBreaches: "",
        notes: "",
        docCid: "",
      });
    } catch (err: any) {
      console.error(err);
      const msg = err?.message?.includes("execution reverted")
        ? "Transaction reverted. Please ensure you have LOGISTICS_ROLE (or the configured role)."
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
          <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
        </div>

        {submitSuccess ? (
          <Card className="p-8 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Submission Successful!</h2>
            <p className="text-gray-600 mb-6">
              Phase 4 (Logistics) data has been successfully submitted to the blockchain
            </p>
            <div className="flex justify-center gap-4">
              <Link href={`/durian/${tokenId}`}><Button>View Details</Button></Link>
              <Button variant="outline" onClick={() => setSubmitSuccess(false)}>Submit Another</Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Step 4：标题 + 权限卡 + 黑色按钮（点击先签名再校验） */}
            <Card className="p-8 mb-6">
              <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <span className="text-4xl">🚚</span>
                  {/* ★ 改成 Step 4 */}
                  Phase 4: Logistics - Step 4
                </h1>
                <p className="text-gray-600 mt-2">
                  Link transportation and cold-chain information to your Durian NFT batch (Token ID from Phase 1)
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Permission Required
                </h4>
                <p className="text-sm text-orange-800 mb-2">
                  You need <span className="font-bold">LOGISTICS_ROLE</span> to submit Logistics data.
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
                    <Truck className="mr-2 h-5 w-5" />
                    Start Logistics Submission
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
                    You can now review logistics telemetry and submit to blockchain.
                  </p>
                </div>
              )}
            </Card>

            {/* 授权后“数据区” */}
            {verified && (
              <Card className="p-8 mb-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Database className="h-6 w-6 text-blue-600" />
                    Cold-chain Telemetry (12 Hours)
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Authorized preview of hourly temperature, humidity, GPS and breach events
                  </p>
                </div>

                <div className="mt-4 grid md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Average Temp</p>
                    <p className="text-2xl font-bold text-blue-600">{avgTemp}°C</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Breach Count</p>
                    <p className="text-2xl font-bold text-blue-600">{breachCount}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Telemetry Points</p>
                    <p className="text-2xl font-bold text-blue-600">{telemetry.length}</p>
                  </div>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="min-w-full divide-y divide-gray-200 border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">TIME</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">TEMP (°C)</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">HUMIDITY (%)</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">GPS</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BREACH</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {telemetry.map((r) => (
                        <tr key={r.idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r">{r.idx}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 border-r">{r.time}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 border-r">{r.tempC.toFixed(1)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 border-r">{r.humidity}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 border-r">{r.gps}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.breach ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                              {r.breach ? "ALERT" : "OK"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* 提交表单 */}
            {verified && (
              <Card className="p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="text-3xl">📝</span>
                    Phase 4: Submit Logistics Data
                  </h2>
                  <p className="text-gray-600 mt-2">Complete the form with logistics details</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Durian Token ID (from Phase 1) *</label>
                    <Input type="text" inputMode="numeric" placeholder="e.g., 1760..." value={tokenId} onChange={(e) => setTokenId(e.target.value.trim())} />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Dispatch Date (YYYY-MM-DD) *</label>
                      <Input type="date" value={form.dispatchDate} onChange={(e) => setForm({ ...form, dispatchDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Arrival Date (YYYY-MM-DD) *</label>
                      <Input type="date" value={form.arrivalDate} onChange={(e) => setForm({ ...form, arrivalDate: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Hours In Transit *</label>
                      <Input type="number" placeholder="e.g., 18" value={form.hoursInTransit} onChange={(e) => setForm({ ...form, hoursInTransit: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Avg Transit Temp (°C) *</label>
                      <Input type="number" step="0.01" placeholder="e.g., 5.60" value={form.avgTransitTempC} onChange={(e) => setForm({ ...form, avgTransitTempC: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Cold-chain Breaches</label>
                      <Input type="number" placeholder="e.g., 0" value={form.coldChainBreaches} onChange={(e) => setForm({ ...form, coldChainBreaches: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Carrier / 3PL</label>
                      <Input type="text" placeholder="e.g., FreshMove Logistics" value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Vehicle / Container ID</label>
                      <Input type="text" placeholder="e.g., TRK-9281 / CNT-22G1" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text sm font-medium mb-2">Origin</label>
                      <Input type="text" placeholder="e.g., Raub, Pahang" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text sm font-medium mb-2">Destination</label>
                      <Input type="text" placeholder="e.g., Singapore DC" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Notes (optional)</label>
                    <Textarea rows={3} placeholder="e.g., Sealed container with continuous data logger; handover at 14:10." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Document CID (optional; leave empty to auto-generate mock CID)</label>
                    <Input type="text" placeholder="ipfs://... or CID" value={form.docCid} onChange={(e) => setForm({ ...form, docCid: e.target.value })} />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">📝 Submission Information</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Data will be permanently stored on the blockchain</li>
                      <li>• Rewards can be claimed after verification</li>
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

