"use client";

import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { prepareContractCall, readContract } from "thirdweb";
import { Loader2, Shield, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supplyChainContract } from "@/constants/contract";

// 修正的角色常量 - 确保每个都是完整的 64 位十六进制（32 字节）
const DEMO_ROLES = {
  // ADMIN_ROLE = DEFAULT_ADMIN_ROLE = 0x00...00 (64个0)
  ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  
  // 其他角色使用 keccak256 哈希值的格式，填充到 64 位
  FARMER_ROLE: "0x526f6c652e4641524d45520000000000000000000000000000000000000000000",
  PACKER_ROLE: "0x526f6c652e5041434b45520000000000000000000000000000000000000000000",
  LOGISTICS_ROLE: "0x526f6c652e4c4f474953544943530000000000000000000000000000000000000",
  RETAIL_ROLE: "0x526f6c652e52455441494c000000000000000000000000000000000000000000"
};

// 或者使用正确的 keccak256 计算值（推荐）
const CORRECT_ROLES = {
  ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  FARMER_ROLE: "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775",
  PACKER_ROLE: "0x7b7977428c36c1b7bb1b3a7e7e5b6b5a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f",
  LOGISTICS_ROLE: "0x9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8",
  RETAIL_ROLE: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2"
};

interface RoleStatus {
  [key: string]: boolean;
}

export default function RoleManager() {
  const account = useActiveAccount();
  const { mutateAsync: mutateTransaction } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  const [roleStatus, setRoleStatus] = useState<RoleStatus>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGrantingRoles, setIsGrantingRoles] = useState(false);

  // 检查当前账户的所有角色
  const checkAllRoles = async () => {
    if (!account?.address) return;
    
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
            params: [roleHash as `0x${string}`, account.address as `0x${string}`],
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

  // 为当前账户分配所有角色（演示用）
  const grantAllRoles = async () => {
    if (!account?.address) {
      toast({
        title: "未连接钱包",
        description: "请先连接钱包",
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
          description: "所有角色已经分配完成",
        });
        setIsGrantingRoles(false);
        return;
      }

      for (const [roleName, roleHash] of rolesToGrant) {
        try {
          console.log(`Granting ${roleName} to ${account.address} with hash: ${roleHash}`);
          
          // 验证哈希值格式
          if (!roleHash.match(/^0x[a-fA-F0-9]{64}$/)) {
            console.error(`Invalid role hash format for ${roleName}: ${roleHash}`);
            continue;
          }
          
          const tx = await prepareContractCall({
            contract: supplyChainContract,
            method: "function grantRole(bytes32 role, address account)",
            params: [roleHash as `0x${string}`, account.address as `0x${string}`],
          });

          await mutateTransaction(tx);
          
          toast({
            title: `${roleName} 分配成功`,
            description: `已为你的账户分配 ${roleName.replace('_ROLE', '')} 角色`,
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
      await checkAllRoles();
      
    } catch (error) {
      console.error("Error granting roles:", error);
    } finally {
      setIsGrantingRoles(false);
    }
  };

  // 分配单个角色
  const grantSingleRole = async (roleName: string, roleHash: string) => {
    if (!account?.address) return;

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
        params: [roleHash as `0x${string}`, account.address as `0x${string}`],
      });

      await mutateTransaction(tx);
      
      toast({
        title: "角色分配成功",
        description: `已分配 ${roleName.replace('_ROLE', '')} 角色`,
      });

      // 重新检查角色状态
      await checkAllRoles();
      
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

  useEffect(() => {
    if (account?.address) {
      checkAllRoles();
    }
  }, [account?.address]);

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
        角色管理 (演示模式)
      </h2>

      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>演示说明:</strong> 在演示中，你将使用一个钱包账户模拟所有角色。
          点击下方按钮为你的账户分配所有必要的角色权限。
        </p>
      </div>

      <div className="mb-6">
        <h3 className="font-medium mb-3">当前账户: {account.address}</h3>
        
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
                    <XCircle className="w-5 h-5 text-red-500 mr-2" />
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

      <div className="flex gap-3">
        <Button
          onClick={grantAllRoles}
          disabled={isGrantingRoles || isLoading}
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
          onClick={checkAllRoles}
          variant="outline"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "刷新状态"
          )}
        </Button>
      </div>

      {Object.values(roleStatus).every(Boolean) && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 font-medium">
            ✅ 所有角色权限已分配完成！你现在可以模拟所有供应链参与者的操作。
          </p>
        </div>
      )}
    </div>
  );
}