"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { prepareContractCall, readContract } from "thirdweb";
import { supplyChainContract, nftContract } from "@/constants/contract";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  getPhaseIcon, 
  getStatusText, 
  formatTimestamp, 
  shortenAddress,
  getCountdown,
  formatTokenAmount,
  getErrorMessage
} from "@/lib/helpers";
import { PHASE_NAMES, ROLES } from "@/types";
import { 
  Loader2, 
  ExternalLink, 
  Gift,
  CheckCircle,
  Clock,
  Lock,
  User,
  Calendar,
  Hash,
  FileText
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface PhaseInfo {
  phase: number;
  submitted: boolean;
  verified: boolean;
  claimed: boolean;
  submitter: string;
  submittedAt: number;
  dataHash: string;
  packedData: bigint;
  cid: string;
  reward: bigint;
}

export default function DurianDetailPage() {
  const params = useParams();
  const tokenId = params.tokenId as string;
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [nftOwner, setNftOwner] = useState<string>("");
  const [tokenURI, setTokenURI] = useState<string>("");
  const [phases, setPhases] = useState<PhaseInfo[]>([]);
  const [retailReadyAt, setRetailReadyAt] = useState<number>(0);
  const [claimingPhase, setClaimingPhase] = useState<number | null>(null);

  useEffect(() => {
    if (tokenId) {
      loadTokenData();
    }
  }, [tokenId]);

  const loadTokenData = async () => {
    setLoading(true);
    try {
      // Get NFT owner
      const owner = await readContract({
        contract: nftContract,
        method: "function ownerOf(uint256 tokenId) view returns (address)",
        params: [BigInt(tokenId)],
      });
      setNftOwner(owner);

      // Get token URI
      try {
        const uri = await readContract({
          contract: nftContract,
          method: "function tokenURI(uint256 tokenId) view returns (string)",
          params: [BigInt(tokenId)],
        });
        setTokenURI(uri);
      } catch (error) {
        console.log("No token URI set");
      }

      // Get retail ready timestamp
      const readyAt = await readContract({
        contract: supplyChainContract,
        method: "function retailReadyAt(uint256 tokenId) view returns (uint64)",
        params: [BigInt(tokenId)],
      });
      setRetailReadyAt(Number(readyAt));

      // Get phase data for all 5 phases
      const phaseData: PhaseInfo[] = [];
      for (let phase = 1; phase <= 5; phase++) {
        const status = await readContract({
          contract: supplyChainContract,
          method: "function phaseStatus(uint256 tokenId, uint8 phase) view returns (bool submitted, bool verified, bool claimed)",
          params: [BigInt(tokenId), phase],
        });

        const meta = await readContract({
          contract: supplyChainContract,
          method: "function submitMeta(uint256 tokenId, uint8 phase) view returns (address submitter, uint64 submittedAt, bytes32 dataHash, uint256 packedData, string cid)",
          params: [BigInt(tokenId), phase],
        });

        const rewardAmount = await readContract({
          contract: supplyChainContract,
          method: "function rewardForPhase(uint8 phase) view returns (uint256)",
          params: [phase],
        });

        phaseData.push({
          phase,
          submitted: status[0],
          verified: status[1],
          claimed: status[2],
          submitter: meta[0],
          submittedAt: Number(meta[1]),
          dataHash: meta[2],
          packedData: meta[3],
          cid: meta[4],
          reward: rewardAmount,
        });
      }

      setPhases(phaseData);
    } catch (error) {
      console.error("Failed to load token data:", error);
      toast({
        title: "Load Failed",
        description: "Failed to load durian data. Token may not exist.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (phase: number) => {
    if (!account) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to claim rewards",
        variant: "destructive",
      });
      return;
    }

    const phaseInfo = phases[phase - 1];
    
    // Check if user is the submitter
    if (phaseInfo.submitter.toLowerCase() !== account.address.toLowerCase()) {
      toast({
        title: "Not Authorized",
        description: "Only the phase submitter can claim the reward",
        variant: "destructive",
      });
      return;
    }

    setClaimingPhase(phase);

    try {
      const tx = prepareContractCall({
        contract: supplyChainContract,
        method: "function claimReward(uint256 tokenId, uint8 phase)",
        params: [BigInt(tokenId), phase],
      });

      await sendTransaction(tx);

      toast({
        title: "Reward Claimed! 🎉",
        description: `Successfully claimed ${formatTokenAmount(phaseInfo.reward)} tokens for Phase ${phase}`,
      });

      // Reload data
      await loadTokenData();
    } catch (error: any) {
      console.error("Claim failed:", error);
      toast({
        title: "Claim Failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setClaimingPhase(null);
    }
  };

  const canClaimPhase = (phaseInfo: PhaseInfo): boolean => {
    if (!phaseInfo.submitted || phaseInfo.claimed) return false;
    
    if (phaseInfo.phase === 5) {
      // Phase 5 needs 7-day lock
      if (retailReadyAt === 0) return false;
      return Date.now() / 1000 >= retailReadyAt;
    } else {
      // Phase 1-4 need verification
      return phaseInfo.verified;
    }
  };

  const getPhaseStatusBadge = (phaseInfo: PhaseInfo) => {
    if (phaseInfo.claimed) {
      return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">✅ Claimed</span>;
    }
    if (phaseInfo.verified) {
      return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">✅ Verified</span>;
    }
    if (phaseInfo.submitted) {
      return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">⏳ Pending</span>;
    }
    return <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">⚪ Not Submitted</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Header />
          </div>
        </div>
        <div className="max-w-6xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Header />
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Home
          </Link>
        </div>

        {/* NFT Basic Info Card */}
        <Card className="p-8 mb-8">
          <div className="flex items-start gap-8">
            <div className="flex-shrink-0">
              <Image
                src="/durian-logo.png"
                alt="Durian NFT"
                width={150}
                height={150}
                className="rounded-lg border-4 border-yellow-200"
              />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
                🌴 Durian #{tokenId}
              </h1>
              <div className="grid md:grid-cols-2 gap-4 text-gray-700">
                <div className="flex items-center gap-2">
                  <Hash className="h-5 w-5 text-gray-500" />
                  <span className="font-medium">Token ID:</span>
                  <span className="font-mono">{tokenId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-gray-500" />
                  <span className="font-medium">Owner:</span>
                  <span className="font-mono">{shortenAddress(nftOwner)}</span>
                </div>
                {tokenURI && (
                  <div className="flex items-center gap-2 col-span-2">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">Metadata:</span>
                    <a 
                      href={tokenURI} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View on IPFS <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Five-Phase Timeline */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
            📋 Supply Chain Timeline
          </h2>
          
          <div className="space-y-4">
            {phases.map((phaseInfo, index) => (
              <Card key={phaseInfo.phase} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  {/* Left: Phase Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{getPhaseIcon(phaseInfo.phase)}</span>
                      <div>
                        <h3 className="text-xl font-bold">
                          Phase {phaseInfo.phase}: {PHASE_NAMES[phaseInfo.phase as keyof typeof PHASE_NAMES]}
                        </h3>
                        {getPhaseStatusBadge(phaseInfo)}
                      </div>
                    </div>

                    {phaseInfo.submitted && (
                      <div className="ml-12 space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">Submitter:</span>
                          <span className="font-mono">{shortenAddress(phaseInfo.submitter)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span className="font-medium">Submitted:</span>
                          <span>{formatTimestamp(phaseInfo.submittedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          <span className="font-medium">Data Hash:</span>
                          <span className="font-mono text-xs">{phaseInfo.dataHash.substring(0, 20)}...</span>
                        </div>
                        {phaseInfo.cid && (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="font-medium">IPFS:</span>
                            <a 
                              href={`https://ipfs.io/ipfs/${phaseInfo.cid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {phaseInfo.cid.substring(0, 15)}... <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Reward Section */}
                  <div className="flex-shrink-0 ml-6 text-right">
                    <div className="text-sm text-gray-500 mb-2">Reward</div>
                    <div className="text-2xl font-bold text-green-600 mb-3">
                      {formatTokenAmount(phaseInfo.reward)} TOKEN
                    </div>

                    {/* Claim Button Logic */}
                    {phaseInfo.claimed ? (
                      <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
                        ✅ Claimed
                      </div>
                    ) : phaseInfo.submitted && account?.address.toLowerCase() === phaseInfo.submitter.toLowerCase() ? (
                      <>
                        {phaseInfo.phase === 5 && phaseInfo.verified && !phaseInfo.claimed ? (
                          <>
                            {canClaimPhase(phaseInfo) ? (
                              <Button
                                onClick={() => handleClaimReward(5)}
                                disabled={claimingPhase === 5}
                                className="w-full"
                              >
                                {claimingPhase === 5 ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Claiming...
                                  </>
                                ) : (
                                  <>
                                    <Gift className="mr-2 h-4 w-4" />
                                    Claim Reward
                                  </>
                                )}
                              </Button>
                            ) : (
                              <div className="px-3 py-2 bg-orange-100 text-orange-800 rounded-lg text-sm">
                                <Clock className="inline h-4 w-4 mr-1" />
                                Unlocks in {getCountdown(retailReadyAt)}
                              </div>
                            )}
                          </>
                        ) : canClaimPhase(phaseInfo) ? (
                          <Button
                            onClick={() => handleClaimReward(phaseInfo.phase)}
                            disabled={claimingPhase === phaseInfo.phase}
                            className="w-full"
                          >
                            {claimingPhase === phaseInfo.phase ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Claiming...
                              </>
                            ) : (
                              <>
                                <Gift className="mr-2 h-4 w-4" />
                                Claim Reward
                              </>
                            )}
                          </Button>
                        ) : (
                          <div className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">
                            <Lock className="inline h-4 w-4 mr-1" />
                            {phaseInfo.verified ? "Locked" : "Awaiting Verification"}
                          </div>
                        )}
                      </>
                    ) : phaseInfo.submitted ? (
                      <div className="text-xs text-gray-500">
                        Only submitter can claim
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        Not submitted yet
                      </div>
                    )}
                  </div>
                </div>

                {/* Connection Line to Next Phase */}
                {index < phases.length - 1 && (
                  <div className="ml-6 mt-4 mb-(-4) border-l-2 border-gray-300 h-8"></div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Total Rewards Summary */}
        <Card className="p-6 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">Total Supply Chain Rewards</h3>
              <p className="text-sm text-gray-600">Complete all phases to maximize earnings</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-600">
                {formatTokenAmount(phases.reduce((sum, p) => sum + p.reward, BigInt(0)))} TOKEN
              </div>
              <div className="text-sm text-gray-600">
                Claimed: {phases.filter(p => p.claimed).length} / 5 phases
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
