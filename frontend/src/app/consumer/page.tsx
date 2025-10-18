"use client";

import { useState } from "react";
import Link from "next/link";
import { readContract, getContractEvents, prepareEvent } from "thirdweb";
import { Header } from "@/components/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supplyChainContract, nftContract } from "@/constants/contract";

import {
  Search,
  Package,
  CheckCircle,
  Clock,
  MapPin,
  Thermometer,
  Scale,
  Calendar,
  User,
  Shield,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

/* =========================
   事件签名
   ========================= */
const PhaseSubmitted = prepareEvent({
  signature:
    "event PhaseSubmitted(uint256 indexed tokenId, uint8 indexed phase, bytes32 dataHash, uint256 packedData, string cid, address indexed submitter, uint64 submittedAt)",
});

const PhaseVerified = prepareEvent({
  signature:
    "event PhaseVerified(uint256 indexed tokenId, uint8 indexed phase, address indexed verifier, uint64 verifiedAt)",
});

type PhaseData = {
  phase: number;
  submitter: string;
  submittedAt: number;
  verified: boolean;
  verifier?: string;
  verifiedAt?: number;
  temperature?: number;
  humidity?: number;
  weight?: number;
  location?: string;
  cid?: string;
};

type DurianInfo = {
  tokenId: string;
  exists: boolean;
  owner?: string;
  phases: PhaseData[];
};

const PHASE_NAMES = {
  1: "Farming",
  2: "Harvest",
  3: "Packing",
  4: "Logistics",
  5: "Retail",
};

const PHASE_ICONS = {
  1: "🌱",
  2: "🌾",
  3: "📦",
  4: "🚚",
  5: "🏪",
};

// Demo 数据类型
type PhaseDetail = PhaseData & {
  details: Record<string, any>;
};

type DemoInfo = {
  tokenId: string;
  exists: boolean;
  owner: string;
  phases: PhaseDetail[];
};

export default function ConsumerPage() {
  const { toast } = useToast();
  const [tokenId, setTokenId] = useState("");
  const [loading, setLoading] = useState(false);
  const [durianInfo, setDurianInfo] = useState<DemoInfo | null>(null);

  // 🎭 Demo 数据生成函数
  const generateDemoData = (inputTokenId: string): DemoInfo => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return {
      tokenId: inputTokenId,
      exists: true,
      owner: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
      phases: [
        // Phase 1: Farming
        {
          phase: 1,
          submitter: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
          submittedAt: Math.floor((now - 14 * dayMs) / 1000),
          verified: true,
          verifier: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
          verifiedAt: Math.floor((now - 14 * dayMs) / 1000),
          cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          details: {
            farmName: "Durian Paradise Farm",
            location: "Pahang, Malaysia",
            plantingDate: new Date(now - 365 * dayMs).toISOString().split('T')[0],
            treeAge: "8",
            cultivar: "Musang King",
            soilPh: "5.8",
            avgRainfallMm: "2400",
            pestControl: "Integrated Pest Management (IPM); certified organic methods used",
            fertilizerType: "Organic compost blend with NPK supplementation",
            certifications: "GAP (Good Agricultural Practice), Organic certification pending",
          }
        },
        // Phase 2: Harvest
        {
          phase: 2,
          submitter: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
          submittedAt: Math.floor((now - 10 * dayMs) / 1000),
          verified: true,
          verifier: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
          verifiedAt: Math.floor((now - 9 * dayMs) / 1000),
          cid: "bafybeihkoviema7g3gxyt6la7vd5ho32ictqbilu3wnlo3rs7ewhnp7liy",
          details: {
            harvestDate: new Date(now - 10 * dayMs).toISOString().split('T')[0],
            avgWeightKg: "1.85",
            brix: "15.4",
            qualityGrade: "A",
            totalFruits: "120",
            harvestMethod: "Natural drop (fallen ripe fruits)",
            defects: "Minor surface blemishes on <2% of fruits; no pest damage observed",
            inspector: "Certified quality inspector - ID: QI-2025-042",
          }
        },
        // Phase 3: Packing
        {
          phase: 3,
          submitter: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
          submittedAt: Math.floor((now - 8 * dayMs) / 1000),
          verified: true,
          verifier: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
          verifiedAt: Math.floor((now - 7 * dayMs) / 1000),
          cid: "bafybeihdwdcefgh4e57f2sh7w3bnzrjuzw4e6jlj2o5fj7n6k5l4m3n2o1",
          details: {
            packingDate: new Date(now - 8 * dayMs).toISOString().split('T')[0],
            facilityId: "FAC-001",
            avgBoxWeightKg: "15.50",
            packagingType: "Carton",
            coldChain: "Yes",
            storageTemp: "4-6°C",
            sealBatchId: "SEAL-BATCH-2025-10",
            boxesProduced: "8",
            notes: "Packed using food-grade liners; pallets heat-treated per ISPM-15 standards",
            qcChecked: "Passed - Inspector ID: QC-PKG-089",
          }
        },
        // Phase 4: Logistics
        {
          phase: 4,
          submitter: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
          submittedAt: Math.floor((now - 5 * dayMs) / 1000),
          verified: true,
          verifier: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
          verifiedAt: Math.floor((now - 4 * dayMs) / 1000),
          cid: "bafybeiejd6eovs62hj3y4l5w3rtzxu5vg7wj8yi9zaz0xb1yc2zd3ae4",
          details: {
            dispatchDate: new Date(now - 5 * dayMs).toISOString().split('T')[0],
            arrivalDate: new Date(now - 3 * dayMs).toISOString().split('T')[0],
            carrier: "Global Freight Express",
            vehicleId: "VEH-2025-1001",
            driverName: "Ahmad bin Rahman",
            driverLicense: "DL-MY-123456",
            origin: "Packing Facility - FAC-001",
            destination: "Distribution Center - DC-SG",
            distance: "450 km",
            avgTransitTempC: "6.2",
            coldChainBreaches: "0",
            gpsTracking: "Enabled - View full route",
            notes: "Cold-chain maintained throughout transit; GPS tracking enabled; temperature logs attached",
          }
        },
        // Phase 5: Retail
        {
          phase: 5,
          submitter: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
          submittedAt: Math.floor((now - 1 * dayMs) / 1000),
          verified: true,
          verifier: "0xcED19B7c05e11441c7623472C84cdE32Faf69991",
          verifiedAt: Math.floor((now - 1 * dayMs) / 1000),
          cid: "bafybeifx5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9",
          details: {
            receivedDate: new Date(now - 3 * dayMs).toISOString().split('T')[0],
            saleDate: new Date(now - 1 * dayMs).toISOString().split('T')[0],
            storeId: "STORE-2025-001",
            storeName: "Premium Fruits Market",
            city: "Kuala Lumpur",
            unitsReceived: "50",
            unitsSold: "45",
            pricePerKg: "32.00",
            currency: "MYR",
            avgStoreTempC: "4.5",
            displayCondition: "Refrigerated display case",
            customerRating: "4.8/5.0",
            customerNotes: "Premium quality, excellent customer feedback. Durians stored in optimal conditions with regular temperature monitoring.",
          }
        },
      ],
    };
  };

  const handleSearch = async () => {
    if (!tokenId.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a Token ID",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    // 模拟加载延迟
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const demoData = generateDemoData(tokenId);
      setDurianInfo(demoData);

      toast({
        title: "Demo Data Loaded! 🎉",
        description: `Showing demo supply chain journey for Token #${tokenId}`,
      });
    } catch (e: any) {
      console.error("Search failed:", e);
      toast({
        title: "Search Failed",
        description: e?.message || "Failed to load durian information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 via-orange-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Header />
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* 顶部导航 */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Home
          </Link>
        </div>

        {/* 页面标题 */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-4 rounded-full">
              <Package className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-3">
            Durian Verification Portal 
            <span className="ml-3 text-lg font-normal bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full">
              🎭 DEMO MODE
            </span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Demo version: Enter any Token ID to see a complete supply chain journey with sample data.
            All information displayed is for demonstration purposes.
          </p>
        </div>

        {/* 搜索框 */}
        <Card className="p-8 bg-white shadow-lg">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Enter any Token ID (e.g., 12345, ABC001, etc.) - Demo Mode"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="h-12 text-lg"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="h-12 px-8 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            >
              {loading ? (
                <>
                  <Clock className="mr-2 h-5 w-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-5 w-5" />
                  Verify Durian
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* 搜索结果 */}
        {durianInfo && (
          <div className="space-y-6">
            {/* NFT 信息卡片 */}
            <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="h-6 w-6 text-green-600" />
                    <h2 className="text-2xl font-bold text-green-900">
                      Verified Authentic Durian
                    </h2>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-green-700" />
                      <span className="text-green-800">
                        Token ID: <span className="font-mono font-bold">#{durianInfo.tokenId}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-green-700" />
                      <span className="text-green-800">
                        Current Owner: <span className="font-mono">{shortAddr(durianInfo.owner!)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-700" />
                      <span className="text-green-800">
                        Completed Phases: <span className="font-bold">{durianInfo.phases.length} of 5</span>
                      </span>
                    </div>
                  </div>
                </div>
                <Badge className="bg-green-600 text-white text-lg px-4 py-2">
                  ✓ Verified
                </Badge>
              </div>
            </Card>

            {/* 供应链时间线 */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Calendar className="h-6 w-6 text-blue-600" />
                Supply Chain Journey
              </h2>

              {durianInfo.phases.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg text-gray-600 mb-2">No Supply Chain Data Yet</p>
                  <p className="text-sm text-gray-500">
                    This durian NFT has been minted but no supply chain phases have been submitted yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {durianInfo.phases.map((phase, idx) => (
                  <div key={phase.phase} className="relative">
                    {/* 连接线 */}
                    {idx < durianInfo.phases.length - 1 && (
                      <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 to-blue-100"></div>
                    )}

                    <div className="flex gap-4">
                      {/* 阶段图标 */}
                      <div className="relative flex-shrink-0">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                            phase.verified
                              ? "bg-gradient-to-br from-green-400 to-green-600 ring-4 ring-green-100"
                              : "bg-gradient-to-br from-gray-300 to-gray-400 ring-4 ring-gray-100"
                          }`}
                        >
                          {PHASE_ICONS[phase.phase as keyof typeof PHASE_ICONS]}
                        </div>
                        {phase.verified && (
                          <CheckCircle className="absolute -top-1 -right-1 h-5 w-5 text-green-600 bg-white rounded-full" />
                        )}
                      </div>

                      {/* 阶段详情 */}
                      <Card className="flex-1 p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-bold">
                              Phase {phase.phase}: {PHASE_NAMES[phase.phase as keyof typeof PHASE_NAMES]}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {new Date(phase.submittedAt * 1000).toLocaleString()}
                            </p>
                          </div>
                          <Badge
                            variant={phase.verified ? "default" : "secondary"}
                            className={
                              phase.verified
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }
                          >
                            {phase.verified ? "✓ Verified" : "⏳ Pending"}
                          </Badge>
                        </div>

                        {/* 详细信息展示 */}
                        {(phase as PhaseDetail).details && (
                          <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-semibold text-sm text-gray-700 mb-2">📋 Submitted Data:</h4>
                            <div className="grid md:grid-cols-2 gap-3">
                              {Object.entries((phase as PhaseDetail).details).map(([key, value]) => (
                                <div key={key} className="text-sm">
                                  <span className="text-gray-500 capitalize">
                                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                                  </span>
                                  <div className="font-medium text-gray-900 mt-0.5">
                                    {String(value)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2 text-sm border-t pt-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                              Submitted by: <span className="font-mono">{shortAddr(phase.submitter)}</span>
                            </span>
                          </div>
                          {phase.verified && phase.verifier && (
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-green-500" />
                              <span className="text-gray-600">
                                Verified by: <span className="font-mono">{shortAddr(phase.verifier)}</span>
                              </span>
                              <span className="text-xs text-gray-400">
                                ({new Date(phase.verifiedAt! * 1000).toLocaleString()})
                              </span>
                            </div>
                          )}
                          {phase.cid && phase.cid !== "" && (
                            <div className="flex items-center gap-2">
                              <ExternalLink className="h-4 w-4 text-blue-500" />
                              <a
                                href={`https://ipfs.io/ipfs/${phase.cid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline font-mono text-xs"
                              >
                                View IPFS Data
                              </a>
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </Card>

            {/* 底部提示 */}
            <Card className="p-4 bg-purple-50 border-purple-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-purple-600 mt-0.5" />
                <div className="text-sm text-purple-900">
                  <p className="font-semibold mb-1">🎭 Demo Mode Information</p>
                  <p className="mb-2">
                    This is a <strong>demonstration version</strong> showing sample data for all 5 supply chain phases.
                    Each phase displays the detailed information that participants submit during the actual process:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Phase 1 (Farming):</strong> Farm details, planting info, soil conditions, certifications</li>
                    <li><strong>Phase 2 (Harvest):</strong> Harvest date, fruit quality, Brix level, defect inspection</li>
                    <li><strong>Phase 3 (Packing):</strong> Packing facility, box weight, cold chain, seal batches</li>
                    <li><strong>Phase 4 (Logistics):</strong> Transportation details, GPS tracking, temperature monitoring</li>
                    <li><strong>Phase 5 (Retail):</strong> Store information, sales data, customer feedback</li>
                  </ul>
                  <p className="mt-2 text-xs text-purple-700">
                    💡 In production mode, this data would be fetched from the blockchain and verified by smart contracts.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
