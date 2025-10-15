"use client";

import { useState } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { prepareContractCall, getContractEvents, prepareEvent } from "thirdweb";
import { supplyChainContract, nftContract } from "@/constants/contract";
import { generateDataHash, generateMockCID, getErrorMessage } from "@/lib/helpers";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, CheckCircle, Leaf, Database, Shield } from "lucide-react";
import Link from "next/link";

// Mock IoT Data Generator
const generateIoTData = () => {
  const data = [];
  const startDate = new Date("2025-10-01");
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      airTemp: (25 + Math.random() * 5).toFixed(1),
      airHumidity: (70 + Math.random() * 15).toFixed(1),
      airQuality: (80 + Math.random() * 15).toFixed(0),
      soilMoisture: (60 + Math.random() * 20).toFixed(1),
      soilCondition: ['Good', 'Excellent', 'Good', 'Fair'][Math.floor(Math.random() * 4)],
      pestCondition: ['None', 'Low', 'None', 'None'][Math.floor(Math.random() * 4)],
      weatherPattern: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][Math.floor(Math.random() * 4)]
    });
  }
  
  return data;
};

export default function SubmitFarming() {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  const [mintedTokenId, setMintedTokenId] = useState<string>("");
  const [formData, setFormData] = useState({
    avgTemp: "",
    avgHumidity: "",
    area: "",
    fertilizer: "",
    pestControl: "",
  });
  const [minting, setMinting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mintSuccess, setMintSuccess] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [iotData] = useState(generateIoTData());

  const handleMintNFT = async () => {
    if (!account) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    setMinting(true);
    try {
      // Generate unique tokenId using timestamp + random number
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const newTokenId = BigInt(timestamp * 10000 + random);
      
      // Mint new Durian NFT with correct parameters
      const mintTx = prepareContractCall({
        contract: nftContract,
        method: "function mintDurian(address to, uint256 tokenId, string calldata tokenUri)",
        params: [account.address, newTokenId, ""], // to, tokenId, empty URI
      });

      const receipt = await sendTransaction(mintTx);
      
      // Store the tokenId we just minted
      setMintedTokenId(newTokenId.toString());
      setMintSuccess(true);
      
      toast({
        title: "NFT Minted Successfully! 🎉",
        description: `Your Durian Token ID is: ${newTokenId.toString()}`,
        duration: 5000,
      });

    } catch (error: any) {
      console.error("Minting failed:", error);
      
      // Check for specific error messages
      let errorDescription = getErrorMessage(error);
      
      if (error.message && error.message.includes("execution reverted")) {
        errorDescription = "Transaction failed. Please ensure you have FARMER_ROLE permission. Go to Roles page to grant yourself this role.";
      }
      
      toast({
        title: "Minting Failed",
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setMinting(false);
    }
  };

  const handleSubmitPhase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!mintedTokenId) {
      toast({
        title: "No Token ID",
        description: "Please mint an NFT first or enter a Token ID",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Calculate average from IoT data
      const avgTempFromIoT = iotData.reduce((sum, d) => sum + parseFloat(d.airTemp), 0) / iotData.length;
      const avgHumidityFromIoT = iotData.reduce((sum, d) => sum + parseFloat(d.airHumidity), 0) / iotData.length;

      // Prepare phase data
      const phaseData = {
        phase: 1,
        timestamp: Date.now(),
        avgTemp: formData.avgTemp || avgTempFromIoT.toFixed(1),
        avgHumidity: formData.avgHumidity || avgHumidityFromIoT.toFixed(1),
        area: parseFloat(formData.area),
        fertilizer: formData.fertilizer,
        pestControl: formData.pestControl,
        iotRecords: iotData.length
      };

      // Generate data hash and CID
      const dataHash = generateDataHash(phaseData);
      const cid = generateMockCID();

      // Pack numerical data
      const packedData = 
        (BigInt(Math.floor(parseFloat(phaseData.avgTemp) * 100)) << BigInt(176)) |
        (BigInt(Math.floor(parseFloat(phaseData.avgHumidity) * 100)) << BigInt(96)) |
        BigInt(Math.floor(phaseData.area * 100));

      // Submit to blockchain
      const submitTx = prepareContractCall({
        contract: supplyChainContract,
        method: "function submitPhase(uint256 tokenId, uint8 phase, bytes32 dataHash, uint256 packedData, string calldata cid)",
        params: [BigInt(mintedTokenId), 1, dataHash as `0x${string}`, packedData, cid],
      });

      await sendTransaction(submitTx);

      setSubmitSuccess(true);
      toast({
        title: "Phase 1 Submitted Successfully! 🎉",
        description: `Farming data for Token #${mintedTokenId} has been submitted to the blockchain`,
        duration: 5000,
      });

      // Reset form
      setFormData({
        avgTemp: "",
        avgHumidity: "",
        area: "",
        fertilizer: "",
        pestControl: "",
      });

    } catch (error: any) {
      console.error("Submission failed:", error);
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
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white">
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
              Phase 1 (Farming) data has been successfully submitted to the blockchain
            </p>
            <div className="flex justify-center gap-4">
              <Link href={`/durian/${mintedTokenId}`}>
                <Button>View Details</Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitSuccess(false);
                  setMintSuccess(false);
                  setMintedTokenId("");
                }}
              >
                Submit Another
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Step 1: Mint NFT */}
            <Card className="p-8 mb-6">
              <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <span className="text-4xl">🌱</span>
                  Phase 1: Farming - Step 1
                </h1>
                <p className="text-gray-600 mt-2">
                  First, mint a new Durian NFT to represent this batch
                </p>
              </div>

              {!mintSuccess ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                      <Leaf className="h-5 w-5" />
                      What is NFT Minting?
                    </h4>
                    <p className="text-sm text-blue-800">
                      Minting creates a unique digital certificate (NFT) for your durian batch. 
                      This NFT will track the entire supply chain journey from farm to retail.
                    </p>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h4 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Permission Required
                    </h4>
                    <p className="text-sm text-orange-800 mb-2">
                      You need <span className="font-bold">FARMER_ROLE</span> to mint NFTs.
                    </p>
                    <p className="text-xs text-orange-700">
                      If minting fails, please go to the <Link href="/roles" className="underline font-medium">Roles page</Link> to grant yourself FARMER_ROLE first.
                    </p>
                  </div>

                  <Button
                    onClick={handleMintNFT}
                    disabled={minting || !account}
                    className="w-full h-12 text-lg"
                    size="lg"
                  >
                    {minting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Minting NFT...
                      </>
                    ) : (
                      <>
                        <Leaf className="mr-2 h-5 w-5" />
                        Mint Durian NFT
                      </>
                    )}
                  </Button>

                  {!account && (
                    <p className="text-center text-red-500 text-sm">
                      Please connect your wallet to mint NFT
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <CheckCircle className="inline h-5 w-5 text-green-600 mr-2" />
                    <span className="font-medium text-green-900">NFT Minted Successfully!</span>
                    {mintedTokenId && (
                      <p className="text-sm text-green-800 mt-2">
                        Token ID: <span className="font-mono font-bold">#{mintedTokenId}</span>
                      </p>
                    )}
                  </div>
                  
                  {!mintedTokenId && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Enter Your Token ID (if not auto-detected)
                      </label>
                      <Input
                        type="text"
                        value={mintedTokenId}
                        onChange={(e) => setMintedTokenId(e.target.value)}
                        placeholder="e.g., 1"
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Step 2: IoT Data Display */}
            {mintSuccess && (
              <>
                <Card className="p-8 mb-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Database className="h-6 w-6 text-blue-600" />
                      IoT Sensor Data (14 Days)
                    </h2>
                    <p className="text-gray-600 mt-2">
                      Automated environmental monitoring from 2025-10-01 to 2025-10-14
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Air Temp (°C)</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Air Humidity (%)</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Air Quality</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Soil Moisture (%)</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Soil Condition</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Pest Condition</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weather</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {iotData.map((row, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r">{row.date}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border-r">{row.airTemp}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border-r">{row.airHumidity}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border-r">{row.airQuality}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border-r">{row.soilMoisture}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm border-r">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                row.soilCondition === 'Excellent' ? 'bg-green-100 text-green-800' :
                                row.soilCondition === 'Good' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {row.soilCondition}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm border-r">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                row.pestCondition === 'None' ? 'bg-green-100 text-green-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                                {row.pestCondition}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.weatherPattern}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 grid md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Average Temperature</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {(iotData.reduce((sum, d) => sum + parseFloat(d.airTemp), 0) / iotData.length).toFixed(1)}°C
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-900">Average Humidity</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {(iotData.reduce((sum, d) => sum + parseFloat(d.airHumidity), 0) / iotData.length).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Step 3: Submit Phase Data */}
                <Card className="p-8">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <span className="text-3xl">📝</span>
                      Phase 1: Submit Farming Data
                    </h2>
                    <p className="text-gray-600 mt-2">
                      Complete the form with additional farming details
                    </p>
                  </div>

                  <form onSubmit={handleSubmitPhase} className="space-y-6">
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
                          placeholder="Auto-filled from IoT data"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave empty to use IoT average: {(iotData.reduce((sum, d) => sum + parseFloat(d.airTemp), 0) / iotData.length).toFixed(1)}°C
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
                          placeholder="Auto-filled from IoT data"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave empty to use IoT average: {(iotData.reduce((sum, d) => sum + parseFloat(d.airHumidity), 0) / iotData.length).toFixed(1)}%
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
                        placeholder="e.g., 1000"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Total cultivation area for durian trees
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Fertilizer Usage Records
                      </label>
                      <Textarea
                        value={formData.fertilizer}
                        onChange={(e) => setFormData({ ...formData, fertilizer: e.target.value })}
                        placeholder="e.g., Organic fertilizer 500kg, once per month..."
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
                        placeholder="e.g., Biological control using predatory mites..."
                        rows={3}
                      />
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">📝 Submission Information</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Data will be permanently stored on the blockchain</li>
                        <li>• Includes {iotData.length} days of IoT sensor records</li>
                        <li>• Rewards can be claimed after Phase 2 verification</li>
                      </ul>
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting || !account || !mintedTokenId}
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
              </>
            )}
          </>
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
