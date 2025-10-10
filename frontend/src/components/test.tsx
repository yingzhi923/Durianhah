"use client";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useState, useRef, useEffect } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { prepareContractCall, readContract, toWei } from "thirdweb";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Header } from "./header";
import RoleManager from "./RoleManager"; // 导入角色管理组件

// 合约配置
import {
  supplyChainContract,
  rewardTokenContract,
  nftContract,
} from "@/constants/contract";

interface DurianSupplyChainMVPProps {
  tokenId: number;
}

type Phase = 1 | 2 | 3 | 4 | 5;
type SubmissionStep = "initial" | "approval" | "confirm" | "success";

const PHASE_NAMES = {
  1: "种植 (Planting)",
  2: "收获 (Harvest)",
  3: "包装 (Packing)",
  4: "物流 (Logistics)",
  5: "零售 (Retail)",
};

// 与 RoleManager 中的 DEMO_ROLES 保持一致
// 在文件顶部，更新 DEMO_ROLES 常量
const DEMO_ROLES = {
  ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  FARMER_ROLE: "0x526f6c652e4641524d45520000000000000000000000000000000000000000000",
  PACKER_ROLE: "0x526f6c652e5041434b45520000000000000000000000000000000000000000000",
  LOGISTICS_ROLE: "0x526f6c652e4c4f474953544943530000000000000000000000000000000000000",
  RETAIL_ROLE: "0x526f6c652e52455441494c000000000000000000000000000000000000000000"
};

const PHASE_ROLES = {
  1: "FARMER_ROLE",
  2: "FARMER_ROLE", 
  3: "PACKER_ROLE",
  4: "LOGISTICS_ROLE",
  5: "RETAIL_ROLE",
};

export default function DurianSupplyChainMVP({
  tokenId,
}: DurianSupplyChainMVPProps) {
  // 区块链交互
  const account = useActiveAccount();
  const { mutateAsync: mutateTransaction } = useSendAndConfirmTransaction();
  const { toast } = useToast();

  // UI 状态管理
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [containerHeight, setContainerHeight] = useState("auto");
  const contentRef = useRef<HTMLDivElement>(null);

  // 表单状态
  const [selectedPhase, setSelectedPhase] = useState<Phase>(1);
  const [dataHash, setDataHash] = useState("");
  const [packedData, setPackedData] = useState("");
  const [cid, setCid] = useState("");
  const [submissionStep, setSubmissionStep] = useState<SubmissionStep>("initial");
  const [isApproving, setIsApproving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 阶段状态和角色权限
  const [phaseStatus, setPhaseStatus] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  // 更新容器高度
  useEffect(() => {
    updateContainerHeight();
  }, [isSubmitting, submissionStep, isVisible, error]);

  const updateContainerHeight = () => {
    if (contentRef.current) {
      requestAnimationFrame(() => {
        setContainerHeight(`${contentRef.current?.scrollHeight || 0}px`);
      });
    }
  };

  // 检查用户角色
  const checkUserRoles = async () => {
    if (!account?.address) return;
    
    setIsLoadingRoles(true);
    try {
      const roles = [];
      
      // 检查每个角色
      for (const [roleName, roleHash] of Object.entries(DEMO_ROLES)) {
        try {
          const hasRole = await readContract({
            contract: supplyChainContract,
            method: "function hasRole(bytes32 role, address account) view returns (bool)",
            params: [roleHash as `0x${string}`, account.address as `0x${string}`],
          });
          
          if (hasRole) {
            roles.push(roleName);
          }
        } catch (error) {
          console.error(`Error checking role ${roleName}:`, error);
        }
      }
      
      setUserRoles(roles);
      console.log('User roles:', roles);
    } catch (error) {
      console.error("Error checking user roles:", error);
    } finally {
      setIsLoadingRoles(false);
    }
  };

  // 加载阶段状态
  const loadPhaseStatus = async () => {
    if (!tokenId || !selectedPhase) return;
    
    try {
      console.log('Loading phase status for:', { tokenId, selectedPhase });
      
      const status = await readContract({
        contract: supplyChainContract,
        method: "function phaseStatus(uint256 tokenId, uint8 phase) view returns (bool submitted, bool verified, bool claimed, address submitter, uint64 submittedAt)",
        params: [BigInt(tokenId), selectedPhase],
      });
      
      console.log('Phase status:', status);
      setPhaseStatus(status);
    } catch (error) {
      console.error("Error loading phase status:", error);
      toast({
        title: "加载失败",
        description: "无法加载阶段状态",
        variant: "destructive",
      });
    }
  };

  // 当账户或选择的阶段变化时，重新加载数据
  useEffect(() => {
    if (account?.address) {
      checkUserRoles();
    }
  }, [account?.address]);

  useEffect(() => {
    if (tokenId && selectedPhase) {
      loadPhaseStatus();
    }
  }, [tokenId, selectedPhase]);

  // 生成示例数据哈希
  const generateDataHash = () => {
    const sampleData = {
      phase: selectedPhase,
      timestamp: Date.now(),
      tokenId: tokenId,
      randomData: Math.random(),
    };
    
    // 简单的哈希模拟（实际应用中应使用 keccak256）
    const dataString = JSON.stringify(sampleData);
    const hash = "0x" + 
      Array.from(dataString)
        .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 64)
        .padEnd(64, '0');
    
    setDataHash(hash);
    
    // 生成示例 CID
    setCid(`QmExample${Math.random().toString(36).substring(2, 15)}`);
    
    // 生成示例打包数据
    setPackedData(Math.floor(Math.random() * 1000000).toString());
  };

  // 检查用户是否有所需角色
  const hasRequiredRole = () => {
    const requiredRole = PHASE_ROLES[selectedPhase];
    return userRoles.includes(requiredRole) || userRoles.includes('ADMIN_ROLE');
  };

  // 验证表单数据
  const validateForm = () => {
    if (!tokenId || tokenId <= 0) {
      setError("无效的 Token ID");
      return false;
    }
    
    if (!dataHash || !dataHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      setError("请输入有效的数据哈希 (0x + 64位十六进制)");
      return false;
    }
    
    if (!cid || cid.trim() === '') {
      setError("请输入 IPFS CID");
      return false;
    }
    
    if (packedData && (isNaN(Number(packedData)) || Number(packedData) < 0)) {
      setError("打包数据必须是非负数字");
      return false;
    }
    
    if (!hasRequiredRole()) {
      setError(`您没有提交阶段 ${selectedPhase} 的权限。需要角色: ${PHASE_ROLES[selectedPhase]}`);
      return false;
    }
    
    return true;
  };

  // 处理阶段提交
  const handleSubmitPhase = () => {
    setError(null);
    
    if (!validateForm()) {
      return;
    }
    
    setIsVisible(false);
    setTimeout(() => {
      setIsSubmitting(true);
      setSubmissionStep("confirm");
      setIsVisible(true);
    }, 200);
  };

  const handleCancel = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmissionStep("initial");
      setError(null);
      setIsVisible(true);
    }, 200);
  };

  // 处理合约调用 - 修复 BigInt 转换问题
  const handleConfirm = async () => {
    console.log('=== handleConfirm DEBUG START ===');
    
    try {
      // 验证所有必要的值
      console.log('Input values:', {
        tokenId,
        selectedPhase,
        dataHash,
        packedData,
        cid,
        account: account?.address
      });
      
      if (!account?.address) {
        throw new Error("请先连接钱包");
      }
      
      if (!tokenId || tokenId <= 0) {
        throw new Error("无效的 Token ID");
      }
      
      if (!selectedPhase || selectedPhase < 1 || selectedPhase > 5) {
        throw new Error("无效的阶段");
      }
      
      if (!dataHash || !dataHash.match(/^0x[a-fA-F0-9]{64}$/)) {
        throw new Error("无效的数据哈希");
      }
      
      if (!cid || cid.trim() === '') {
        throw new Error("IPFS CID 不能为空");
      }
      
      // 安全的 BigInt 转换
      const safeTokenId = BigInt(tokenId);
      const safePackedData = BigInt(packedData || "0");
      
      console.log('Converted values:', {
        safeTokenId: safeTokenId.toString(),
        selectedPhase,
        dataHash,
        safePackedData: safePackedData.toString(),
        cid
      });
      
      setIsConfirming(true);
      
      const tx = await prepareContractCall({
        contract: supplyChainContract,
        method: "function submitPhase(uint256 tokenId, uint8 phase, bytes32 dataHash, uint256 packedData, string calldata cid)",
        params: [
          safeTokenId,
          selectedPhase,
          dataHash as `0x${string}`,
          safePackedData,
          cid,
        ],
      });

      console.log('Transaction prepared:', tx);

      const result = await mutateTransaction(tx);
      console.log('Transaction result:', result);

      toast({
        title: "提交成功! 🎉",
        description: `阶段 ${selectedPhase} (${PHASE_NAMES[selectedPhase]}) 已成功提交`,
        duration: 5000,
      });

      setSubmissionStep("success");
      await loadPhaseStatus(); // 重新加载状态
      
    } catch (error: any) {
      console.error('handleConfirm error:', error);
      
      let errorMessage = "提交失败";
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "提交失败",
        description: errorMessage,
        variant: "destructive",
      });
      
      setError(errorMessage);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Header />
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="max-w-2xl mx-auto p-6">
        {/* 角色管理组件 */}
        <RoleManager />

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-center">
            榴莲供应链管理系统
          </h1>

          {/* 用户角色显示 */}
          {account?.address && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium mb-2">当前用户权限:</h3>
              {isLoadingRoles ? (
                <div className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  检查权限中...
                </div>
              ) : userRoles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {userRoles.map(role => (
                    <span key={role} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      {role.replace('_ROLE', '')}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">暂无权限角色，请使用上方的角色管理面板分配权限</p>
              )}
            </div>
          )}

          <div
            className="relative transition-[height] duration-300 ease-in-out overflow-hidden"
            style={{ height: containerHeight }}
          >
            <div
              ref={contentRef}
              className={cn(
                "w-full transition-all duration-200 ease-in-out",
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              )}
            >
              {!isSubmitting ? (
                // 初始表单
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Token ID
                    </label>
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <span className="font-mono text-lg">#{tokenId}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      选择阶段 (Phase)
                    </label>
                    <select
                      value={selectedPhase}
                      onChange={(e) => setSelectedPhase(Number(e.target.value) as Phase)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={!account}
                    >
                      {Object.entries(PHASE_NAMES).map(([phase, name]) => (
                        <option key={phase} value={phase}>
                          Phase {phase}: {name}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-600 mt-1">
                      需要角色: {PHASE_ROLES[selectedPhase]}
                    </p>
                  </div>

                  {phaseStatus && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-medium mb-2">当前阶段状态:</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className={cn(
                          "p-2 rounded",
                          phaseStatus[0] ? "bg-green-100 text-green-800" : "bg-gray-100"
                        )}>
                          已提交: {phaseStatus[0] ? "✓" : "✗"}
                        </div>
                        <div className={cn(
                          "p-2 rounded",
                          phaseStatus[1] ? "bg-blue-100 text-blue-800" : "bg-gray-100"
                        )}>
                          已验证: {phaseStatus[1] ? "✓" : "✗"}
                        </div>
                        <div className={cn(
                          "p-2 rounded",
                          phaseStatus[2] ? "bg-purple-100 text-purple-800" : "bg-gray-100"
                        )}>
                          已领取: {phaseStatus[2] ? "✓" : "✗"}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      数据哈希 (Data Hash) *
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="0x1234567890abcdef..."
                        value={dataHash}
                        onChange={(e) => setDataHash(e.target.value)}
                        className="flex-1 font-mono text-sm"
                        maxLength={66}
                      />
                      <Button onClick={generateDataHash} variant="outline">
                        生成示例
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      64位十六进制哈希值 (0x开头)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      打包数据 (Packed Data) - 可选
                    </label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={packedData}
                      onChange={(e) => setPackedData(e.target.value)}
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      自定义数值数据，用于存储额外信息
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      IPFS CID *
                    </label>
                    <Input
                      type="text"
                      placeholder="QmExample1234567890abcdef..."
                      value={cid}
                      onChange={(e) => setCid(e.target.value)}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      IPFS 内容标识符，指向详细数据
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700">
                      {error}
                    </div>
                  )}

                  <Button
                    onClick={handleSubmitPhase}
                    className="w-full py-3 font-bold"
                    disabled={
                      !account ||
                      !hasRequiredRole() ||
                      (phaseStatus && phaseStatus[0]) ||
                      isLoadingRoles
                    }
                  >
                    {!account
                      ? "请连接钱包"
                      : isLoadingRoles
                      ? "检查权限中..."
                      : !hasRequiredRole()
                      ? `需要 ${PHASE_ROLES[selectedPhase].replace('_ROLE', '')} 权限`
                      : phaseStatus && phaseStatus[0]
                      ? "该阶段已提交"
                      : `提交 ${PHASE_NAMES[selectedPhase]} 阶段`}
                  </Button>
                </div>
              ) : (
                // 提交流程
                <div className="space-y-4">
                  {submissionStep === "confirm" && (
                    <div className="border-2 border-gray-300 rounded-lg p-4">
                      <h2 className="text-lg font-bold mb-4">确认提交</h2>
                      <div className="space-y-2 mb-4">
                        <p><strong>Token ID:</strong> #{tokenId}</p>
                        <p><strong>阶段:</strong> {PHASE_NAMES[selectedPhase]}</p>
                        <p><strong>数据哈希:</strong> {dataHash}</p>
                        <p><strong>IPFS CID:</strong> {cid}</p>
                        {packedData && (
                          <p><strong>打包数据:</strong> {packedData}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleConfirm}
                          className="flex-1"
                          disabled={isConfirming}
                        >
                          {isConfirming ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              提交中...
                            </>
                          ) : (
                            "确认提交"
                          )}
                        </Button>
                        <Button
                          onClick={handleCancel}
                          variant="outline"
                          disabled={isConfirming}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  )}

                  {submissionStep === "success" && (
                    <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                      <h2 className="text-lg font-bold mb-4 text-green-800">
                        提交成功! 🎉
                      </h2>
                      <p className="mb-4">
                        阶段 {selectedPhase} 已成功提交到区块链。
                      </p>
                      <Button onClick={handleCancel} className="w-full">
                        返回
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}