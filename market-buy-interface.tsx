import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useState, useRef, useEffect } from "react";
import { useActiveAccount, useSendAndConfirmTransaction, useReadContract } from "thirdweb/react";
import { prepareContractCall, readContract, toWei, toEther } from "thirdweb";
import { contract, oracleContract, tokenContract } from "@/constants/contract";
import { approve } from "thirdweb/extensions/erc20";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { QuadraticCostIndicator } from "./quadratic-cost-indicator";

// Types pour les props du composant
interface MarketBuyInterfaceProps {
  marketId: number;
  market: {
    optionA: string;
    optionB: string;
    question: string;
  };
  category: "Currency" | "General";
}

// Alias de type pour une meilleure lisibilité
type BuyingStep = "initial" | "allowance" | "confirm";
type Option = "A" | "B" | null;

export function MarketBuyInterface({
  marketId,
  market,
  category,
}: MarketBuyInterfaceProps) {
  // Interactions avec la blockchain
  const account = useActiveAccount();
  const { mutateAsync: mutateTransaction } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  // Sélection du contrat en fonction de la catégorie
  const contractToUse = category === "Currency" ? oracleContract : contract;

  // Gestion de l'état de l'interface utilisateur
  const [isBuying, setIsBuying] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [containerHeight, setContainerHeight] = useState("auto");
  const contentRef = useRef<HTMLDivElement>(null);

  // État du vote quadratique
  const [voteCount, setVoteCount] = useState({ A: 0, B: 0 });
  const [quadraticCost, setQuadraticCost] = useState(0);

  // État de la transaction
  const [selectedOption, setSelectedOption] = useState<Option>(null);
  const [amount, setAmount] = useState(0);
  const [buyingStep, setBuyingStep] = useState<BuyingStep>("initial");
  const [isApproving, setIsApproving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Récupérer les compteurs de vote lorsque le compte ou l'ID du marché change
  useEffect(() => {
    if (!account || !marketId) return;

    const fetchVoteCounts = async () => {
      try {
        const voteCounts = await readContract({
          contract: contractToUse,
          method: "function getUserVoteCounts(uint256 _marketId, address _user) view returns (uint256, uint256)",
          params: [BigInt(marketId), account.address],
        });
        setVoteCount({ 
          A: Number(voteCounts[0]), 
          B: Number(voteCounts[1]) 
        });
      } catch (error) {
        console.error("Error fetching vote counts:", error);
      }
    };

    fetchVoteCounts();
  }, [account, marketId, contractToUse]);

  // Obtenir le coût du vote suivant lorsque l'option sélectionnée change
  useEffect(() => {
    const fetchQuadraticCost = async () => {
      if (!selectedOption || !account) {
        setQuadraticCost(0);
        return;
      }

      try {
        const cost = await readContract({
          contract: contractToUse,
          method: "function getNextVoteCost(uint256 _marketId, bool _isOptionA, address _user) view returns (uint256)",
          params: [BigInt(marketId), selectedOption === "A", account.address],
        });
        setQuadraticCost(Number(toEther(cost)));
      } catch (error) {
        console.error("Error getting next vote cost:", error);
        setQuadraticCost(0);
      }
    };

    fetchQuadraticCost();
  }, [selectedOption, account, marketId, contractToUse]);

  // Mettre à jour la hauteur du conteneur lorsque le contenu change
  useEffect(() => {
    updateContainerHeight();
  }, [isBuying, buyingStep, isVisible, error, amount, selectedOption, voteCount, quadraticCost]);

  // Fonction séparée pour mettre à jour la hauteur du conteneur
  const updateContainerHeight = () => {
    if (contentRef.current) {
      // Utiliser requestAnimationFrame pour des calculs de mise en page plus fiables
      requestAnimationFrame(() => {
        setContainerHeight(`${contentRef.current?.scrollHeight || 0}px`);
      });
    }
  };

  // Gestionnaires pour les interactions utilisateur
  const handleBuy = (option: "A" | "B") => {
    setIsVisible(false);
    setTimeout(() => {
      setIsBuying(true);
      setSelectedOption(option);
      setIsVisible(true);
    }, 200); // Correspond à la durée de la transition
  };

  const handleCancel = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsBuying(false);
      setBuyingStep("initial");
      setSelectedOption(null);
      setAmount(0);
      setError(null);
      setIsVisible(true);
    }, 200);
  };

  // Vérifier si l'utilisateur doit approuver la dépense de jetons
  const checkApproval = async () => {
    if (amount <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    
    // Utiliser le coût quadratique pour la vérification d'approbation
    const requiredAmount = quadraticCost;
    
    if (requiredAmount <= 0) {
      setError("Unable to determine vote cost");
      return;
    }
    
    setError(null);

    try {
      const userAllowance = await readContract({
        contract: tokenContract,
        method: "function allowance(address owner, address spender) view returns (uint256)",
        params: [
          account?.address as string,
          category === "Currency" ? oracleContract.address : contract.address,
        ],
      });

      setBuyingStep(
        userAllowance < BigInt(toWei(requiredAmount.toString()))
          ? "allowance"
          : "confirm"
      );
    } catch (error) {
      console.error(error);
    }
  };

  // Gérer la transaction d'approbation du jeton
  const handleSetApproval = async () => {
    setIsApproving(true);
    try {
      const tx = await approve({
        contract: tokenContract,
        spender: category === "Currency" ? oracleContract.address : contract.address,
        amount: quadraticCost,
      });
      await mutateTransaction(tx);

      setBuyingStep("confirm");
    } catch (error) {
      console.error(error);
    } finally {
      setIsApproving(false);
    }
  };

  // Gérer la transaction d'achat de parts
  const handleConfirm = async () => {
    if (!selectedOption || amount <= 0) {
      setError("Must select an option and enter an amount greater than 0");
      return;
    }

    setIsConfirming(true);
    try {
      // Utiliser buyQuadraticVote au lieu de buyShares
      const tx = await prepareContractCall({
        contract: category === "Currency" ? oracleContract : contract,
        method: "function buyQuadraticVote(uint256 _marketId, bool _isOptionA, uint256 _shares)",
        params: [
          BigInt(marketId),
          selectedOption === "A",
          BigInt(toWei(amount.toString())),
        ],
      });
      await mutateTransaction(tx);

      // Afficher un toast de succès
      toast({
        title: "Purchase Successful!",
        description: `You bought ${amount} ${
          selectedOption === "A"
            ? category === "Currency"
              ? "Yes"
              : market.optionA
            : category === "Currency"
            ? "No"
            : market.optionB
        } shares with quadratic voting.`,
        duration: 5000, // 5 secondes
      });

      handleCancel();
    } catch (error) {
      console.error(error);
      // Optionnellement afficher un toast d'erreur
      toast({
        title: "Purchase Failed",
        description: "There was an error processing your purchase.",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  // Add this new useEffect after the existing ones
  useEffect(() => {
    const verifyContractABI = async () => {
      if (!account) return;
      
      try {
        // Try to read a simple function to verify ABI
        const marketInfo = await readContract({
          contract: contractToUse,
          method: "function getMarketInfo(uint256 _marketId) view returns (string, uint256, uint256, uint8, string, string, uint256, uint256, bool)",
          params: [BigInt(marketId)],
        });
        
        console.log("Contract ABI Verification - Market Info:", marketInfo);
        
        // Try to read quadratic-specific function
        const voteCost = await readContract({
          contract: contractToUse,
          method: "function getNextVoteCost(uint256 _marketId, bool _isOptionA, address _user) view returns (uint256)",
          params: [BigInt(marketId), true, account.address],
        });
        
        console.log("Contract ABI Verification - Quadratic Vote Cost:", voteCost);
        
      } catch (error) {
        console.error("Contract ABI Verification Error:", error);
      }
    };
    
    verifyContractABI();
  }, [account, marketId, contractToUse]);

  // Rendre le composant
  return (
    <div
      className="relative transition-[height] duration-300 ease-in-out overflow-hidden"
      style={{ height: containerHeight }}
    >
      <div
        ref={contentRef}
        className={cn(
          "w-full transition-all duration-200 ease-in-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {!isBuying ? (
          // Boutons de sélection d'option initiale
          <div className="flex justify-between gap-4 mb-4">
            <Button
              className={cn(
                "flex-1 bg-green-600/30 hover:bg-green-700/50 text-green-900 hover:text-black border-2 border-green-500",
                !account && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => handleBuy("A")}
              aria-label={`Vote ${
                category === "Currency" ? "Yes" : market.optionA
              } for "${market.question}"`}
              disabled={!account}
              variant="ghost"
            >
              <span className="font-bold ">
                {category === "Currency" ? "Yes" : market.optionA}
              </span>
            </Button>
            <Button
              className={cn(
                "flex-1 bg-red-600/30 hover:bg-red-700/50 text-red-900 hover:text-black border-2 border-red-500",
                !account && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => handleBuy("B")}
              aria-label={`Vote ${
                category === "Currency" ? "No" : market.optionB
              } for "${market.question}"`}
              disabled={!account}
              variant="ghost"
            >
              <span className="font-bold">
                {category === "Currency" ? "No" : market.optionB}
              </span>
            </Button>
          </div>
        ) : (
          // Interface d'achat avec différentes étapes
          <div className="flex flex-col mb-4">
            {buyingStep === "allowance" ? (
              // Étape d'approbation
              <div className="flex flex-col border-2 border-gray-300 rounded-lg p-4">
                <h2 className="text-lg font-bold mb-4">Approval Needed</h2>
                <p className="mb-4">
                  You need to approve the transaction before proceeding.
                </p>
                <div className="flex justify-end">
                  <Button
                    onClick={handleSetApproval}
                    className="mb-2"
                    disabled={isApproving}
                  >
                    {isApproving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      "Set Approval"
                    )}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    className="ml-2"
                    variant="outline"
                    disabled={isApproving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : buyingStep === "confirm" ? (
              // Étape de confirmation
              <div className="flex flex-col border-2 border-gray-300 rounded-lg p-4">
                <h2 className="text-lg font-bold mb-4">Confirm Transaction</h2>
                <p className="mb-4">
                  You are about to buy{" "}
                  <span
                    className={cn(
                      "font-bold",
                      selectedOption === "A" ? "text-green-700" : "text-red-700"
                    )}
                  >
                    {amount}{" "}
                    {selectedOption === "A"
                      ? category === "Currency"
                        ? "Yes"
                        : market.optionA
                      : category === "Currency"
                      ? "No"
                      : market.optionB}
                  </span>{" "}
                  share(s).
                </p>
                <div className="text-xs text-gray-600 mb-4">
                  You will spend{" "}
                  <span className="font-bold">{quadraticCost} SWAN TOKEN</span> for
                  this transaction.
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleConfirm}
                    className="mb-2"
                    disabled={isConfirming}
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      "Confirm"
                    )}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    className="ml-2"
                    variant="outline"
                    disabled={isConfirming}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // Étape de saisie du montant
              <div className="flex flex-col border-2 border-gray-300 rounded-lg p-4">
                {buyingStep === "initial" && selectedOption && (
                  <>
                    {/* Indicateur de coût quadratique */}
                    <QuadraticCostIndicator 
                      voteCount={voteCount[selectedOption as "A" | "B"]} 
                      cost={quadraticCost} 
                    />
                  </>
                )}
                <span className="text-xs text-gray-500 mb-1">
                  {`1 ${
                    selectedOption === "A"
                      ? category === "Currency"
                        ? "Yes"
                        : market.optionA
                      : category === "Currency"
                      ? "No"
                      : market.optionB
                  } = 1 `}
                  <span className="font-bold">SWAN TOKEN</span>
                </span>
                <div className="flex flex-col gap-1 mb-2">
                  <div className="flex items-center gap-2 overflow-visible">
                    <div className="flex-grow relative">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Enter amount"
                        value={amount}
                        onChange={(e) => {
                          const value = Math.max(0, Number(e.target.value));
                          setAmount(value);
                          setError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "e") {
                            e.preventDefault();
                          }
                        }}
                        className={cn(
                          "w-full",
                          error && "border-red-500 focus-visible:ring-red-500",
                          selectedOption === "A"
                            ? "focus-visible:ring-green-500/50 focus-visible:border-green-500"
                            : "focus-visible:ring-red-500/50 focus-visible:border-red-500"
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "font-bold whitespace-nowrap text-base",
                        selectedOption === "A"
                          ? "text-green-700"
                          : "text-red-700"
                      )}
                    >
                      {selectedOption === "A"
                        ? category === "Currency"
                          ? "Yes"
                          : market.optionA
                        : category === "Currency"
                        ? "No"
                        : market.optionB}
                    </span>
                  </div>

                  {/* Message d'exigence de jeton */}
                  <div className="min-h-[1.5rem]">
                    {amount > 0 && (
                      <div className="text-xs text-gray-600 mt-1">
                        You need{" "}
                        <span className="font-bold">{quadraticCost} SWAN TOKEN</span>{" "}
                        for this transaction
                      </div>
                    )}
                  </div>

                  {/* Message d'erreur */}
                  <div className="min-h-[1.5rem]">
                    {error && (
                      <span className="text-sm text-red-500">{error}</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between gap-4">
                  <Button onClick={checkApproval} className="flex-1 font-bold">
                    Confirm
                  </Button>
                  <Button
                    onClick={handleCancel}
                    className="flex-1"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}