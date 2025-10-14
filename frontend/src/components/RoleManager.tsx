"use client";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useState, useEffect } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { prepareContractCall, readContract } from "thirdweb";
import { Loader2, Shield, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supplyChainContract } from "@/constants/contract";

// 使用 types/index.ts 中定义的角色常量
import { ROLES } from "@/types";

const DEMO_ROLES = ROLES;

interface RoleStatus {
  [key: string]: boolean;
}

// 验证以太坊地址格式
const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export default function RoleManager() {
  const account = useActiveAccount();
  const { mutateAsync: mutateTransaction } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  const [targetAddress, setTargetAddress] = useState("");
  const [roleStatus, setRoleStatus] = useState<RoleStatus>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGrantingRoles, setIsGrantingRoles] = useState(false);

  // 检查目标地址的所有角色
  const checkAllRoles = async (address: string) => {
    if (!address || !isValidAddress(address)) return;
    
    setIsLoading(true);
    const newRoleStatus: RoleStatus = {};
    
    try {
      // 使用修正后的角色哈希值
      for (const [roleName, roleHash] of Object.entries(DEMO_ROLES)) {
        try {
          console.log(`Checking role ${roleName} with hash: ${roleHash}`);
          
          // 验证哈希值格式
          if (!roleHash.match(/^0x[a-fA-F0-9]{64}$/)) {
            console.error(`Invalid role hash format for ${roleName}: ${roleHash}`);
            newRoleStatus[roleName] = false;
            continue;
          }
          
          const hasRole = await readContract({
            contract: supplyChainContract,
            method: "function hasRole(bytes32 role, address account) view returns (bool)",
            params: [roleHash as `0x${string}`, address as `0x${string}`],
          });
          
          newRoleStatus[roleName] = hasRole;
          console.log(`${roleName}: ${hasRole}`);
        } catch (error) {
          console.error(`Error checking role ${roleName}:`, error);
          newRoleStatus[roleName] = false;
        }
      }
      
      setRoleStatus(newRoleStatus);
    } catch (error) {
      console.error("Error checking roles:", error);
      toast({
        title: "检查角色失败",
        description: "无法检查用户角色权限",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 为目标地址分配所有角色
  const grantAllRoles = async () => {
    if (!account?.address) {
      toast({
        title: "未连接钱包",
        description: "请先连接钱包",
        variant: "destructive",
      });
      return;
    }

    if (!targetAddress || !isValidAddress(targetAddress)) {
      toast({
        title: "地址无效",
        description: "请输入有效的以太坊地址",
        variant: "destructive",
      });
      return;
    }

    setIsGrantingRoles(true);
    
    try {
      const rolesToGrant = Object.entries(DEMO_ROLES).filter(
        ([roleName]) => !roleStatus[roleName]
      );

      if (rolesToGrant.length === 0) {
        toast({
          title: "无需分配",
          description: "该地址的所有角色已经分配完成",
        });
        setIsGrantingRoles(false);
        return;
      }

      for (const [roleName, roleHash] of rolesToGrant) {
        try {
          console.log(`Granting ${roleName} to ${targetAddress} with hash: ${roleHash}`);
          
          // 验证哈希值格式
          if (!roleHash.match(/^0x[a-fA-F0-9]{64}$/)) {
            console.error(`Invalid role hash format for ${roleName}: ${roleHash}`);
            continue;
          }
          
          const tx = await prepareContractCall({
            contract: supplyChainContract,
            method: "function grantRole(bytes32 role, address account)",
            params: [roleHash as `0x${string}`, targetAddress as `0x${string}`],
          });

          await mutateTransaction(tx);
          
          toast({
            title: `${roleName} 分配成功`,
            description: `已为地址 ${targetAddress.substring(0, 6)}...${targetAddress.substring(38)} 分配 ${roleName.replace('_ROLE', '')} 角色`,
          });
          
          // 等待一下再继续下一个角色
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Error granting ${roleName}:`, error);
          toast({
            title: `${roleName} 分配失败`,
            description: `无法分配 ${roleName} 角色: ${typeof error === "object" && error && "message" in error ? (error as any).message : String(error)}`,
            variant: "destructive",
          });
        }
      }

      // 重新检查角色状态
      await checkAllRoles(targetAddress);
      
    } catch (error) {
      console.error("Error granting roles:", error);
    } finally {
      setIsGrantingRoles(false);
    }
  };

  // 分配单个角色
  const grantSingleRole = async (roleName: string, roleHash: string) => {
    if (!account?.address) return;

    if (!targetAddress || !isValidAddress(targetAddress)) {
      toast({
        title: "地址无效",
        description: "请输入有效的以太坊地址",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`Granting single role ${roleName} with hash: ${roleHash}`);
      
      // 验证哈希值格式
      if (!roleHash.match(/^0x[a-fA-F0-9]{64}$/)) {
        toast({
          title: "哈希值格式错误",
          description: `${roleName} 的哈希值格式不正确`,
          variant: "destructive",
        });
        return;
      }
      
      const tx = await prepareContractCall({
        contract: supplyChainContract,
        method: "function grantRole(bytes32 role, address account)",
        params: [roleHash as `0x${string}`, targetAddress as `0x${string}`],
      });

      await mutateTransaction(tx);
      
      toast({
        title: "角色分配成功",
        description: `已为地址分配 ${roleName.replace('_ROLE', '')} 角色`,
      });

      // 重新检查角色状态
      await checkAllRoles(targetAddress);
      
    } catch (error) {
      console.error(`Error granting ${roleName}:`, error);
      toast({
        title: "角色分配失败",
        description: `无法分配 ${roleName} 角色: ${
          typeof error === "object" && error && "message" in error ? (error as any).message : String(error)
        }`,
        variant: "destructive",
      });
    }
  };

  // 当目标地址变化时，自动检查角色
  useEffect(() => {
    if (targetAddress && isValidAddress(targetAddress)) {
      checkAllRoles(targetAddress);
    } else {
      setRoleStatus({});
    }
  }, [targetAddress]);

  if (!account) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-lg font-bold mb-4 flex items-center">
          <Shield className="mr-2" />
          角色管理
        </h2>
        <p className="text-gray-600">请先连接钱包以管理角色权限</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h2 className="text-lg font-bold mb-4 flex items-center">
        <Shield className="mr-2" />
        角色管理
      </h2>

      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>说明:</strong> 输入目标钱包地址，为该地址分配供应链管理所需的所有角色权限。
        </p>
      </div>

      {/* 目标地址输入 */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          目标钱包地址 *
        </label>
        <div className="flex gap-3">
          <Input
            type="text"
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
            placeholder="0x..."
            className="flex-1 font-mono"
          />
          <Button
            variant="outline"
            onClick={() => account?.address && setTargetAddress(account.address)}
            disabled={!account}
          >
            使用当前钱包
          </Button>
        </div>
        {targetAddress && !isValidAddress(targetAddress) && (
          <p className="text-red-500 text-sm mt-2">⚠️ 无效的钱包地址格式</p>
        )}
      </div>

      {/* 角色状态显示 */}
      {targetAddress && isValidAddress(targetAddress) && (
        <div className="mb-6">
          <h3 className="font-medium mb-3">
            目标地址: {targetAddress.substring(0, 6)}...{targetAddress.substring(38)}
          </h3>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              检查角色权限中...
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(DEMO_ROLES).map(([roleName, roleHash]) => (
                <div key={roleName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    {roleStatus[roleName] ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300 mr-2" />
                    )}
                    <div>
                      <span className="font-medium">
                        {roleName.replace('_ROLE', '')}
                      </span>
                      <div className="text-xs text-gray-500 font-mono">
                        {roleHash.substring(0, 10)}...{roleHash.substring(roleHash.length - 6)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-sm ${
                      roleStatus[roleName] 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {roleStatus[roleName] ? '已授权' : '未授权'}
                    </span>
                    
                    {!roleStatus[roleName] && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => grantSingleRole(roleName, roleHash)}
                        disabled={isGrantingRoles}
                      >
                        授权
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={grantAllRoles}
          disabled={isGrantingRoles || isLoading || !targetAddress || !isValidAddress(targetAddress) || !account}
          className="flex-1"
        >
          {isGrantingRoles ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              分配角色中...
            </>
          ) : (
            "一键分配所有角色"
          )}
        </Button>
        
        <Button
          onClick={() => targetAddress && isValidAddress(targetAddress) && checkAllRoles(targetAddress)}
          variant="outline"
          disabled={isLoading || !targetAddress || !isValidAddress(targetAddress)}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "刷新状态"
          )}
        </Button>
      </div>

      {targetAddress && isValidAddress(targetAddress) && Object.values(roleStatus).every(Boolean) && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 font-medium">
            ✅ 该地址的所有角色权限已分配完成！
          </p>
        </div>
      )}
    </div>
  );
}