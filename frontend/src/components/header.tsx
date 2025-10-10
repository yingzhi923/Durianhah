"use client";

import {
  ConnectButton,
  lightTheme,
  useActiveAccount,
  useSendAndConfirmTransaction,
} from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { client } from "@/app/client";
import { kaiaTestnet } from "@/chain.config";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Gift, TreePine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import {
  rewardTokenContract,
  tokenContractAddress,
} from "@/constants/contract";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const wallets = [
  inAppWallet({
    auth: {
      options: [
        "google",
        "email",
        "passkey",
        "phone",
        "github",
        "apple",
        "facebook",
        "line",
      ],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
];

export function Header() {
  const account = useActiveAccount();
  const [isClaimLoading, setIsClaimLoading] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const { toast } = useToast();

  const { mutateAsync: sendTransaction } = useSendAndConfirmTransaction();

  // 重置动画状态的效果
  useEffect(() => {
    if (showAnimation) {
      const timer = setTimeout(() => {
        setShowAnimation(false);
      }, 1000); // 延长动画显示时间
      return () => clearTimeout(timer);
    }
  }, [showAnimation]);

  const handleClaimTokens = async () => {
    setIsClaimLoading(true);
    try {
      const tx = await prepareContractCall({
        contract: rewardTokenContract,
        method: "function mint(address to, uint256 amount)",
        params: [account?.address, BigInt("1000000000000000000000")], // 1000 tokens
      });

      await sendTransaction(tx);

      toast({
        title: "奖励代币已领取!",
        description: "您的奖励代币已成功领取。请刷新页面查看余额。",
        duration: 5000,
      });

      // 交易成功后，添加短暂延迟然后显示动画
      setTimeout(() => {
        setShowAnimation(true);
      }, 300);
    } catch (error) {
      console.error(error);
      toast({
        title: "领取失败",
        description: "领取奖励代币时出现错误，请重试。",
        variant: "destructive",
      });
    } finally {
      setIsClaimLoading(false);
    }
  };

  return (
    <div className="flex justify-between items-center py-4">
      <div className="flex items-center gap-3">
        <TreePine className="h-8 w-8 text-green-600" />
        <h1 className="text-2xl font-bold m-0 text-gray-800">
          榴莲供应链管理系统
        </h1>
      </div>
      <div className="items-center flex gap-3">
        {account && (
          <Button
            onClick={handleClaimTokens}
            disabled={isClaimLoading}
            variant="outline"
            className={cn(
              "relative overflow-hidden",
              showAnimation ? "border-green-400 text-green-600" : ""
            )}
          >
            {isClaimLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                领取中...
              </>
            ) : (
              <>
                <Gift
                  className={cn(
                    "mr-2 h-4 w-4 transition-transform duration-300",
                    showAnimation ? "scale-110" : ""
                  )}
                />
                领取奖励代币
              </>
            )}

            {/* 涟漪动画 */}
            {showAnimation && (
              <span className="absolute top-0 left-0 right-0 bottom-0 bg-green-300/40 animate-ripple rounded-md"></span>
            )}
          </Button>
        )}
        <ConnectButton
          client={client}
          theme={lightTheme()}
          chain={kaiaTestnet}
          connectButton={{
            style: {
              fontSize: "0.875rem !important",
              height: "2.5rem !important",
            },
          }}
          detailsButton={{
            displayBalanceToken: {
              [kaiaTestnet.id]: tokenContractAddress,
            },
          }}
          wallets={wallets}
          connectModal={{ size: "wide" }}
          accountAbstraction={{
            chain: kaiaTestnet,
            sponsorGas: true,
          }}
        />
      </div>
    </div>
  );
}
