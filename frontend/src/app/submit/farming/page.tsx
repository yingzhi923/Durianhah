"use client";

import { useState } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { supplyChainContract, nftContract } from "@/constants/contract";
import { generateDataHash, generateMockCID, getErrorMessage } from "@/lib/helpers";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SubmitFarming() {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  const [tokenId, setTokenId] = useState("");
  const [formData, setFormData] = useState({
    avgTemp: "",
    avgHumidity: "",
    area: "",
    fertilizer: "",
    pestControl: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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

    setSubmitting(true);
    setSuccess(false);

    try {
      // 1. 如果没有 tokenId，先 mint NFT
      let finalTokenId = tokenId;
      if (!finalTokenId) {
        const newTokenId = Date.now();
        finalTokenId = newTokenId.toString();

        const mintTx = prepareContractCall({
          contract: nftContract,
          method: "function mintDurian(address to, uint256 tokenId, string calldata tokenUri)",
          params: [account.address, BigInt(newTokenId), ""],
        });

        await sendTransaction(mintTx);
        
        toast({
          title: "NFT Minted Successfully",
          description: `Token ID: ${finalTokenId}`,
        });

        setTokenId(finalTokenId);
      }

      // 2. 准备数据
      const phaseData = {
        phase: 1,
        timestamp: Date.now(),
        avgTemp: parseFloat(formData.avgTemp),
        avgHumidity: parseFloat(formData.avgHumidity),
        area: parseFloat(formData.area),
        fertilizer: formData.fertilizer,
        pestControl: formData.pestControl,
      };

      // 3. 生成数据哈希和 CID（实际应用中应上传到 IPFS）
      const dataHash = generateDataHash(phaseData);
      const cid = generateMockCID();

      // 4. 打包数值数据
      const packedData = 
        (BigInt(Math.floor(parseFloat(formData.avgTemp) * 100)) << BigInt(176)) |
        (BigInt(Math.floor(parseFloat(formData.avgHumidity) * 100)) << BigInt(96)) |
        BigInt(Math.floor(parseFloat(formData.area) * 100));

      // 5. 提交到链上
      const submitTx = prepareContractCall({
        contract: supplyChainContract,
        method: "function submitPhase(uint256 tokenId, uint8 phase, bytes32 dataHash, uint256 packedData, string calldata cid)",
        params: [BigInt(finalTokenId), 1, dataHash as `0x${string}`, packedData, cid],
      });

      await sendTransaction(submitTx);

      setSuccess(true);
      toast({
        title: "Submitted Successfully! 🎉",
        description: `Phase 1 data has been successfully submitted to the blockchain`,
        duration: 5000,
      });

      // 重置表单
      setFormData({
        avgTemp: "",
        avgHumidity: "",
        area: "",
        fertilizer: "",
        pestControl: "",
      });

    } catch (error: any) {
      console.error("提交失败:", error);
      toast({
        title: "Submission Failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Header />
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Home
          </Link>
        </div>

        {success ? (
          <Card className="p-8 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Submission Successful!</h2>
            <p className="text-gray-600 mb-6">
              Phase 1 (Farming) data has been successfully submitted to the blockchain
            </p>
            <div className="flex justify-center gap-4">
              <Link href={`/durian/${tokenId}`}>
                <Button>View Details</Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => setSuccess(false)}
              >
                Continue Submitting
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <span className="text-4xl">🌱</span>
                Phase 1: Farming
              </h1>
              <p className="text-gray-600 mt-2">
                Submit IoT monitoring data and farming activity records for the cultivation phase
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Durian Token ID
                  <span className="text-gray-500 font-normal ml-2">
                    (Leave blank to auto-create new NFT)
                  </span>
                </label>
                <Input
                  type="text"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  placeholder="Optional, e.g.: 1234567890"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Average Temperature (°C) *
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.avgTemp}
                    onChange={(e) => setFormData({ ...formData, avgTemp: e.target.value })}
                    placeholder="e.g.: 28.5"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Average temperature during cultivation period
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Average Humidity (%) *
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.avgHumidity}
                    onChange={(e) => setFormData({ ...formData, avgHumidity: e.target.value })}
                    placeholder="e.g.: 75.0"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Average humidity during cultivation period
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Cultivation Area (m²) *
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  placeholder="e.g.: 1000"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Cultivation area for durian trees
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Fertilizer Usage Records
                </label>
                <Textarea
                  value={formData.fertilizer}
                  onChange={(e) => setFormData({ ...formData, fertilizer: e.target.value })}
                  placeholder="e.g.: Organic fertilizer 500kg, once per month..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Pest Control Records
                </label>
                <Textarea
                  value={formData.pestControl}
                  onChange={(e) => setFormData({ ...formData, pestControl: e.target.value })}
                  placeholder="e.g.: Biological control using predatory mites..."
                  rows={3}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">📝 Submission Instructions</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Data will be permanently stored on the blockchain after submission</li>
                  <li>• Rewards can only be obtained after verification by the next phase (Harvest)</li>
                  <li>• Ensure data is accurate and authentic, as it cannot be modified</li>
                </ul>
              </div>

              <Button
                type="submit"
                disabled={submitting || !account}
                className="w-full h-12 text-lg"
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

        {/* 其他阶段快速导航 */}
        <div className="mt-8">
          <h3 className="font-semibold mb-4">Other Phase Submissions</h3>
          <div className="grid md:grid-cols-4 gap-4">
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
