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
  const [grantingRole, setGrantingRole] = useState<string | null>(null);

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
      console.error("Role check failed:", error);
      toast({
        title: "Check Failed",
        description: "Unable to check roles for target address",
        variant: "destructive",
      });
    } finally {
      setCheckingRoles(false);
    }
  };

  const grantAllRoles = async () => {
    if (!account?.address) {
      toast({
        title: "Insufficient Permissions",
        description: "Need to connect wallet",
        variant: "destructive",
      });
      return;
    }

    if (!targetAddress || !isValidAddress(targetAddress)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid wallet address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Grant all roles for supply chain contract
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
            console.log(`✅ Supply Chain: ${roleName} granted successfully`);
            
            toast({
              title: `${roleName} Granted Successfully`,
              description: `Granted ${roleName} role for supply chain contract`,
            });
          } else {
            console.log(`⏭️ Supply Chain: ${roleName} already exists, skipped`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Supply Chain: ${roleName} grant failed:`, error);
        }
      }

      // Grant FARMER_ROLE for NFT contract
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
          console.log(`✅ NFT: FARMER_ROLE granted successfully`);
          
          toast({
            title: "NFT FARMER_ROLE Granted Successfully",
            description: "Granted minting permission for NFT contract",
          });
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ NFT: FARMER_ROLE grant failed:`, error);
      }

      toast({
        title: "Role Granting Completed",
        description: `Success: ${successCount}, Failed: ${errorCount}`,
        variant: errorCount > 0 ? "destructive" : "default",
      });

      await checkTargetRoles();
    } catch (error: any) {
      console.error("Batch granting failed:", error);
      toast({
        title: "Granting Failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const grantSingleRole = async (roleName: string, roleHash: string, isNFTContract: boolean = false) => {
    if (!account?.address) {
      toast({
        title: "Insufficient Permissions",
        description: "Need to connect wallet",
        variant: "destructive",
      });
      return;
    }

    if (!targetAddress || !isValidAddress(targetAddress)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid wallet address",
        variant: "destructive",
      });
      return;
    }

    setGrantingRole(roleName);

    try {
      const contract = isNFTContract ? nftContract : supplyChainContract;
      
      const hasRole = await readContract({
        contract,
        method: "function hasRole(bytes32 role, address account) view returns (bool)",
        params: [roleHash as `0x${string}`, targetAddress],
      });

      if (hasRole) {
        toast({
          title: "Role Already Exists",
          description: `Target address already has ${roleName}`,
        });
        return;
      }

      const tx = prepareContractCall({
        contract,
        method: "function grantRole(bytes32 role, address account)",
        params: [roleHash as `0x${string}`, targetAddress],
      });

      await sendTransaction(tx);
      
      toast({
        title: `${roleName} Granted Successfully`,
        description: `Successfully granted ${roleName} to target address`,
      });

      await checkTargetRoles();
    } catch (error: any) {
      console.error(`❌ ${roleName} grant failed:`, error);
      toast({
        title: "Granting Failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setGrantingRole(null);
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
            <h2 className="text-2xl font-bold mb-2">Please Connect Wallet</h2>
            <p className="text-gray-600">You need to connect your wallet to access role management features</p>
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
                <h3 className="font-semibold text-yellow-900">Permission Notice</h3>
                <p className="text-sm text-yellow-800 mt-1">
                  You currently do not have admin permissions. If you are the contract deployer or an authorized admin, you can proceed.
                  If you lack permissions, the transaction will be rejected on-chain.
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
                <h3 className="font-semibold text-green-900">Admin Permission Confirmed</h3>
                <p className="text-sm text-green-800 mt-1">
                  You have admin permissions and can assign roles to any address.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Role Management Center
          </h1>
          <p className="text-gray-600 mt-2">Manage permissions for supply chain participants</p>
        </div>

        {/* 目标地址输入 */}
        <Card className="p-6 mb-6">
          <h3 className="font-semibold mb-4">Target Wallet Address</h3>
          <div className="flex gap-3">
            <Input
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 font-mono"
            />
            <Button onClick={fillCurrentAddress} variant="outline">
              📋 Use Current Wallet
            </Button>
          </div>
          {targetAddress && !isValidAddress(targetAddress) && (
            <p className="text-red-500 text-sm mt-2">⚠️ Invalid wallet address</p>
          )}
        </Card>

        {/* 快速操作 */}
        <Card className="p-6 mb-6">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <Button
            onClick={grantAllRoles}
            disabled={loading || !targetAddress || !isValidAddress(targetAddress)}
            className="w-full h-12 text-lg"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              "✨ Grant All Roles"
            )}
          </Button>
        </Card>

        {/* 角色状态显示 */}
        {currentRoles && (
          <>
            <Card className="p-6 mb-6">
              <h3 className="font-semibold mb-4 flex items-center justify-between">
                <span>📜 Supply Chain Management Contract Roles</span>
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
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          currentRoles[roleName]
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {currentRoles[roleName] ? "✅ Granted" : "❌ Not Granted"}
                      </span>
                      {!currentRoles[roleName] && (
                        <Button
                          size="sm"
                          onClick={() => grantSingleRole(roleName, roleHash, false)}
                          disabled={grantingRole === roleName || !targetAddress || !isValidAddress(targetAddress)}
                        >
                          {grantingRole === roleName ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Granting...
                            </>
                          ) : (
                            "Grant Role"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 mb-6">
              <h3 className="font-semibold mb-4">🌴 NFT Contract (Durian721) Roles</h3>
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
                          <div className="font-medium">FARMER</div>
                          <div className="text-xs text-gray-500">Can mint durian NFTs</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            nftRoles.FARMER_ROLE
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {nftRoles.FARMER_ROLE ? "✅ Granted" : "❌ Not Granted"}
                        </span>
                        {!nftRoles.FARMER_ROLE && (
                          <Button
                            size="sm"
                            onClick={() => grantSingleRole("FARMER_ROLE (NFT)", ROLES.FARMER_ROLE, true)}
                            disabled={grantingRole === "FARMER_ROLE (NFT)" || !targetAddress || !isValidAddress(targetAddress)}
                          >
                            {grantingRole === "FARMER_ROLE (NFT)" ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Granting...
                              </>
                            ) : (
                              "Grant Role"
                            )}
                          </Button>
                        )}
                      </div>
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
            📖 Role Permissions Guide
          </h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>
                <strong className="text-blue-700">ADMIN_ROLE</strong>: Highest authority, can manage other roles, set rewards, pause contracts
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>
                <strong className="text-blue-700">FARMER_ROLE (Supply Chain)</strong>: Can submit Phase 1, 2 data
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>
                <strong className="text-blue-700">FARMER_ROLE (NFT)</strong>: Can mint durian NFTs
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>
                <strong className="text-blue-700">PACKER_ROLE</strong>: Can submit Phase 3, can verify Phase 2
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>
                <strong className="text-blue-700">LOGISTICS_ROLE</strong>: Can submit Phase 4, can verify Phase 3
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>
                <strong className="text-blue-700">RETAIL_ROLE</strong>: Can submit Phase 5, can verify Phase 4
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
