"use client";

import { useState, useEffect } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { prepareContractCall, readContract } from "thirdweb";
import { supplyChainContract, nftContract } from "@/constants/contract";
import { ROLES, ROLE_NAMES } from "@/types";
import { shortenAddress, getErrorMessage } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Header } from "@/components/header";

interface RoleStatus {
  [key: string]: boolean;
}

export default function RoleManagementPage() {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  const [targetAddress, setTargetAddress] = useState("");
  const [currentRoles, setCurrentRoles] = useState<RoleStatus | null>(null);
  const [nftRoles, setNftRoles] = useState<RoleStatus | null>(null);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingRoles, setCheckingRoles] = useState(false);

  useEffect(() => {
    if (account) {
      checkCurrentUserAdminStatus();
    }
  }, [account]);

  useEffect(() => {
    if (targetAddress && isValidAddress(targetAddress)) {
      checkTargetRoles();
    }
  }, [targetAddress]);

  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const checkCurrentUserAdminStatus = async () => {
    try {
      const hasAdmin = await readContract({
        contract: supplyChainContract,
        method: "function hasRole(bytes32 role, address account) view returns (bool)",
        params: [ROLES.ADMIN_ROLE, account!.address],
      });
      setCurrentUserIsAdmin(hasAdmin);
    } catch (error) {
      console.error("检查管理员权限失败:", error);
      setCurrentUserIsAdmin(false);
    }
  };

  const checkTargetRoles = async () => {
    setCheckingRoles(true);
    try {
      const roles: RoleStatus = {};
      const nftRoleStatus: RoleStatus = {};

      // 检查供应链合约的所有角色
      for (const [roleName, roleHash] of Object.entries(ROLES)) {
        try {
          const hasRole = await readContract({
            contract: supplyChainContract,
            method: "function hasRole(bytes32 role, address account) view returns (bool)",
            params: [roleHash, targetAddress],
          });
          roles[roleName] = hasRole;
        } catch (error) {
          console.error(`检查角色 ${roleName} 失败:`, error);
          roles[roleName] = false;
        }
      }

      // 检查 NFT 合约的角色
      try {
        const hasNFTAdmin = await readContract({
          contract: nftContract,
          method: "function hasRole(bytes32 role, address account) view returns (bool)",
          params: [ROLES.ADMIN_ROLE, targetAddress],
        });
        nftRoleStatus.ADMIN_ROLE = hasNFTAdmin;

        const hasNFTFarmer = await readContract({
          contract: nftContract,
          method: "function hasRole(bytes32 role, address account) view returns (bool)",
          params: [ROLES.FARMER_ROLE, targetAddress],
        });
        nftRoleStatus.FARMER_ROLE = hasNFTFarmer;
      } catch (error) {
        console.error("检查 NFT 合约角色失败:", error);
      }

      setCurrentRoles(roles);
      setNftRoles(nftRoleStatus);
    } catch (error) {
      console.error("检查角色失败:", error);
      toast({
        title: "检查失败",
        description: "无法检查目标地址的角色",
        variant: "destructive",
      });
    } finally {
      setCheckingRoles(false);
    }
  };

  const grantAllRoles = async () => {
    if (!account?.address) {
      toast({
        title: "权限不足",
        description: "需要连接钱包",
        variant: "destructive",
      });
      return;
    }

    if (!targetAddress || !isValidAddress(targetAddress)) {
      toast({
        title: "地址无效",
        description: "请输入有效的钱包地址",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // 授予供应链合约的所有角色
      for (const [roleName, roleHash] of Object.entries(ROLES)) {
        try {
          const hasRole = await readContract({
            contract: supplyChainContract,
            method: "function hasRole(bytes32 role, address account) view returns (bool)",
            params: [roleHash, targetAddress],
          });

          if (!hasRole) {
            const tx = prepareContractCall({
              contract: supplyChainContract,
              method: "function grantRole(bytes32 role, address account)",
              params: [roleHash, targetAddress],
            });

            await sendTransaction(tx);
            successCount++;
            console.log(`✅ 供应链: ${roleName} 授予成功`);
            
            toast({
              title: `${roleName} 授予成功`,
              description: `已授予供应链合约的 ${roleName} 角色`,
            });
          } else {
            console.log(`⏭️ 供应链: ${roleName} 已存在，跳过`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ 供应链: ${roleName} 授予失败:`, error);
        }
      }

      // 授予 NFT 合约的 FARMER_ROLE
      try {
        const hasNFTFarmer = await readContract({
          contract: nftContract,
          method: "function hasRole(bytes32 role, address account) view returns (bool)",
          params: [ROLES.FARMER_ROLE, targetAddress],
        });

        if (!hasNFTFarmer) {
          const tx = prepareContractCall({
            contract: nftContract,
            method: "function grantRole(bytes32 role, address account)",
            params: [ROLES.FARMER_ROLE, targetAddress],
          });

          await sendTransaction(tx);
          successCount++;
          console.log(`✅ NFT: FARMER_ROLE 授予成功`);
          
          toast({
            title: "NFT FARMER_ROLE 授予成功",
            description: "已授予 NFT 合约的铸造权限",
          });
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ NFT: FARMER_ROLE 授予失败:`, error);
      }

      toast({
        title: "角色授予完成",
        description: `成功: ${successCount} 个，失败: ${errorCount} 个`,
        variant: errorCount > 0 ? "destructive" : "default",
      });

      await checkTargetRoles();
    } catch (error: any) {
      console.error("批量授予失败:", error);
      toast({
        title: "授予失败",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fillCurrentAddress = () => {
    if (account) {
      setTargetAddress(account.address);
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Header />
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-6">
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">请先连接钱包</h2>
            <p className="text-gray-600">您需要连接钱包才能访问角色管理功能</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Header />
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* 显示当前用户是否为管理员 */}
        {!currentUserIsAdmin && (
          <Card className="p-4 mb-6 bg-yellow-50 border-yellow-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900">权限提示</h3>
                <p className="text-sm text-yellow-800 mt-1">
                  您当前没有管理员权限。如果您是合约部署者或已授权的管理员，可以继续操作。
                  如果您没有权限，交易将在链上被拒绝。
                </p>
              </div>
            </div>
          </Card>
        )}

        {currentUserIsAdmin && (
          <Card className="p-4 mb-6 bg-green-50 border-green-200">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900">管理员权限已确认</h3>
                <p className="text-sm text-green-800 mt-1">
                  您拥有管理员权限，可以为任何地址分配角色。
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            角色管理中心
          </h1>
          <p className="text-gray-600 mt-2">管理供应链参与者的权限</p>
        </div>

        {/* 目标地址输入 */}
        <Card className="p-6 mb-6">
          <h3 className="font-semibold mb-4">目标钱包地址</h3>
          <div className="flex gap-3">
            <Input
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 font-mono"
            />
            <Button onClick={fillCurrentAddress} variant="outline">
              📋 使用当前钱包
            </Button>
          </div>
          {targetAddress && !isValidAddress(targetAddress) && (
            <p className="text-red-500 text-sm mt-2">⚠️ 无效的钱包地址</p>
          )}
        </Card>

        {/* 快速操作 */}
        <Card className="p-6 mb-6">
          <h3 className="font-semibold mb-4">快速操作</h3>
          <Button
            onClick={grantAllRoles}
            disabled={loading || !targetAddress || !isValidAddress(targetAddress)}
            className="w-full h-12 text-lg"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                处理中...
              </>
            ) : (
              "✨ 一键授予所有角色"
            )}
          </Button>
        </Card>

        {/* 角色状态显示 */}
        {currentRoles && (
          <>
            <Card className="p-6 mb-6">
              <h3 className="font-semibold mb-4 flex items-center justify-between">
                <span>📜 供应链管理合约角色</span>
                {checkingRoles && <Loader2 className="h-4 w-4 animate-spin" />}
              </h3>
              <div className="space-y-3">
                {Object.entries(ROLES).map(([roleName, roleHash]) => (
                  <div
                    key={roleName}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {currentRoles[roleName] ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-300" />
                      )}
                      <div>
                        <div className="font-medium">
                          {ROLE_NAMES[roleName as keyof typeof ROLE_NAMES] || roleName}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {roleHash.substring(0, 10)}...{roleHash.substring(roleHash.length - 8)}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        currentRoles[roleName]
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {currentRoles[roleName] ? "✅ 已授权" : "❌ 未授权"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 mb-6">
              <h3 className="font-semibold mb-4">🌴 NFT 合约 (Durian721) 角色</h3>
              <div className="space-y-3">
                {nftRoles && (
                  <>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {nftRoles.FARMER_ROLE ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300" />
                        )}
                        <div>
                          <div className="font-medium">FARMER (铸造权限)</div>
                          <div className="text-xs text-gray-500">可以铸造榴莲 NFT</div>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          nftRoles.FARMER_ROLE
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {nftRoles.FARMER_ROLE ? "✅ 已授权" : "❌ 未授权"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </>
        )}

        {/* 角色说明 */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            📖 角色权限说明
          </h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>
                <strong className="text-blue-700">ADMIN_ROLE</strong>: 最高权限，可管理其他角色、设置奖励、暂停合约
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>
                <strong className="text-blue-700">FARMER_ROLE (供应链)</strong>: 可提交 Phase 1, 2 数据
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>
                <strong className="text-blue-700">FARMER_ROLE (NFT)</strong>: 可铸造榴莲 NFT
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>
                <strong className="text-blue-700">PACKER_ROLE</strong>: 可提交 Phase 3，可核验 Phase 2
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>
                <strong className="text-blue-700">LOGISTICS_ROLE</strong>: 可提交 Phase 4，可核验 Phase 3
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>
                <strong className="text-blue-700">RETAIL_ROLE</strong>: 可提交 Phase 5，可核验 Phase 4
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
