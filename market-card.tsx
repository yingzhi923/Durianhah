import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { contract, oracleContract } from "@/constants/contract";
import { MarketProgress } from "./market-progress";
import { MarketTime } from "./market-time";
import { MarketCardSkeleton } from "./market-card-skeleton";
import { MarketResolved } from "./market-resolved";
import { MarketPending } from "./market-pending";
import { MarketBuyInterface } from "./market-buy-interface";
import { MarketSharesDisplay } from "./market-shares-display";
import { MarketResolveInterface } from "./market-resolve-interface";
import { toEther } from "thirdweb";
import { useEffect, useState } from "react";

interface MarketCardProps {
  index: number;
  filter: "active" | "pending" | "resolved";
  category: "Currency" | "General";
  onClick: (index: number, title: string) => void;
  onTitleLoad?: (title: string) => void;
  onStatusChange?: (status: "active" | "pending" | "resolved") => void;
}

interface CurrencyMarket {
  assetSymbol: string;
  operator: number;
  targetPrice: bigint;
  endTime: bigint;
  outcome: number;
  totalOptionAShares: bigint;
  totalOptionBShares: bigint;
  resolved: boolean;
}

enum ComparisonOperator {
  GREATER_THAN,
  LESS_THAN,
  EQUAL,
}

const operatorToSymbol = (operator: number): string => {
  switch (operator) {
    case ComparisonOperator.GREATER_THAN:
      return ">";
    case ComparisonOperator.LESS_THAN:
      return "<";
    case ComparisonOperator.EQUAL:
      return "=";
    default:
      return "";
  }
};

interface GeneralMarket {
  question: string;
  endTime: bigint;
  outcome: number;
  optionA: string;
  optionB: string;
  totalOptionAShares: bigint;
  totalOptionBShares: bigint;
  resolved: boolean;
}

interface SharesBalance {
  optionAShares: bigint;
  optionBShares: bigint;
}

export function MarketCard({
  index,
  filter,
  category,
  onClick,
  onTitleLoad,
  onStatusChange,
}: MarketCardProps) {
  // Get the active account
  const account = useActiveAccount();
  const [title, setTitle] = useState<string>("");
  const [shouldRender, setShouldRender] = useState(true);

  // Determine the contract and method to use based on the category
  const contractToUse = category === "Currency" ? oracleContract : contract;
  const methodToUse =
    category === "Currency"
      ? "function getMarketInfo(uint256 _marketId) view returns (string assetSymbol, uint8 operator, uint256 targetPrice, uint256 endTime,uint256 duration, uint8 outcome, uint256 totalOptionAShares, uint256 totalOptionBShares, bool resolved)"
      : "function getMarketInfo(uint256 _marketId) view returns (string question, uint256 endTime,uint256 duration, uint8 outcome, string optionA, string optionB, uint256 totalOptionAShares, uint256 totalOptionBShares, bool resolved)";

  // Get the market data
  const { data: marketData, isLoading: isLoadingMarketData } = useReadContract({
    contract: contractToUse,
    method: methodToUse,
    params: [BigInt(index)],
  });

  // Parse the market data
  const market: CurrencyMarket | GeneralMarket | undefined = marketData
    ? category === "Currency"
      ? {
          assetSymbol: marketData[0],
          operator: marketData[1],
          targetPrice: marketData[2],
          endTime: marketData[3],
          duration: marketData[4],
          outcome: marketData[5],
          totalOptionAShares: marketData[6],
          totalOptionBShares: marketData[7],
          resolved: marketData[8],
        }
      : {
          question: marketData[0],
          endTime: marketData[1],
          duration: marketData[2],
          outcome: marketData[3],
          optionA: marketData[4],
          optionB: marketData[5],
          totalOptionAShares: marketData[6],
          totalOptionBShares: marketData[7],
          resolved: marketData[8],
        }
    : undefined;

  // Get the shares balance
  const { data: sharesBalanceData } = useReadContract({
    contract: contractToUse,
    method:
      "function getSharesBalance(uint256 _marketId, address _user) view returns (uint256 optionAShares, uint256 optionBShares)",
    params: [BigInt(index), account?.address as string],
  });

  // Parse the shares balance
  const sharesBalance: SharesBalance | undefined = sharesBalanceData
    ? {
        optionAShares: sharesBalanceData[0],
        optionBShares: sharesBalanceData[1],
      }
    : undefined;

  // 计算市场标题
  useEffect(() => {
    if (marketData) {
      let marketTitle = "";

      if (category === "Currency") {
        const assetSymbols = market?.assetSymbol?.split("/");
        const marketSymbol = assetSymbols ? assetSymbols[0].toUpperCase() : "";
        const quoteSymbol = assetSymbols ? assetSymbols[1].toUpperCase() : "";

        marketTitle = `Will 1 ${marketSymbol} ${operatorToSymbol(
          market?.operator
        )} ${Number(market?.targetPrice) / 10 ** 8} ${quoteSymbol}?`;
      } else {
        marketTitle = (market as GeneralMarket)?.question || "";
      }

      setTitle(marketTitle);

      // 通知父组件标题已加载
      if (onTitleLoad && marketTitle) {
        onTitleLoad(marketTitle);
      }
    }
  }, [marketData, category, market, onTitleLoad]);

  // 检查卡片是否应该显示，并通知父组件市场状态
  useEffect(() => {
    if (!market) {
      setShouldRender(false);
      return;
    }

    // Check if the market is expired
    const isExpired = new Date(Number(market.endTime) * 1000) < new Date();
    // Check if the market is resolved
    const isResolved = market.resolved;

    // 确定市场状态
    let status: "active" | "pending" | "resolved";
    if (!isExpired) {
      status = "active";
    } else if (isExpired && !isResolved) {
      status = "pending";
    } else {
      status = "resolved";
    }

    // 通知父组件状态变化
    if (onStatusChange) {
      onStatusChange(status);
    }

    switch (filter) {
      case "active":
        setShouldRender(!isExpired);
        break;
      case "pending":
        setShouldRender(isExpired && !isResolved);
        break;
      case "resolved":
        setShouldRender(isExpired && isResolved);
        break;
      default:
        setShouldRender(true);
    }
  }, [market, filter, onStatusChange]);

  // 如果不应该渲染，返回 null
  if (!shouldRender) {
    return null;
  }

  // Check if the market is expired
  const isExpired = market
    ? new Date(Number(market.endTime) * 1000) < new Date()
    : false;
  // Check if the market is resolved
  const isResolved = market ? market.resolved : false;

  return (
    <Card
      key={index}
      className="flex flex-col transition-colors duration-300 ease-in-out hover:bg-gray-200"
      onClick={() => onClick(index, title)}
    >
      {isLoadingMarketData ? (
        <MarketCardSkeleton />
      ) : (
        <>
          <CardHeader>
            {market && (
              <MarketTime
                endTime={market.endTime}
                category={category}
                isResolved={isResolved}
              />
            )}
            <CardTitle className="flex items-center">
              {/* <HelpCircle className="mr-2 h-5 w-5 text-primary" /> */}
              {title}
              <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-800">
                Quadratic
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {market && (
              <MarketProgress
                optionA={category === "Currency" ? "Yes" : market.optionA}
                optionB={category === "Currency" ? "No" : market.optionB}
                totalOptionAShares={market.totalOptionAShares}
                totalOptionBShares={market.totalOptionBShares}
              />
            )}
            {isExpired ? (
              isResolved ? (
                <MarketResolved
                  marketId={index}
                  outcome={market!.outcome}
                  optionA={
                    category === "Currency"
                      ? "Yes"
                      : (market as GeneralMarket).optionA
                  }
                  optionB={
                    category === "Currency"
                      ? "No"
                      : (market as GeneralMarket).optionB
                  }
                  category={category}
                  canClaim={
                    sharesBalance?.optionAShares !== BigInt(0) ||
                    sharesBalance?.optionBShares !== BigInt(0)
                  }
                />
              ) : (
                <>
                  {category === "Currency" ? (
                    <MarketResolveInterface
                      marketId={index}
                      endTime={market!.endTime}
                      assetSymbol={(market as CurrencyMarket).assetSymbol}
                      operator={(market as CurrencyMarket).operator}
                      targetPrice={(market as CurrencyMarket).targetPrice}
                    />
                  ) : (
                    <MarketPending />
                  )}
                </>
              )
            ) : (
              market && (
                <MarketBuyInterface
                  marketId={index}
                  market={market}
                  category={category}
                />
              )
            )}
          </CardContent>
          <CardFooter>
            {market && sharesBalance && (
              <MarketSharesDisplay
                market={market}
                sharesBalance={sharesBalance}
                category={category}
                marketId={index}
              />
            )}
          </CardFooter>
        </>
      )}
    </Card>
  );
}
