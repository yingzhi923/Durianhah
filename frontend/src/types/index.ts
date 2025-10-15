export interface PhaseData {
  phase: 1 | 2 | 3 | 4 | 5;
  name: string;
  submitted: boolean;
  verified: boolean;
  claimed: boolean;
  submitter: string;
  submittedAt: number;
  dataHash: string;
  packedData: string;
  cid: string;
  reward: string;
}

export interface DurianToken {
  tokenId: string;
  owner: string;
  tokenURI: string;
  phases: PhaseData[];
  retailReadyAt?: number;
}

export interface DashboardStats {
  totalTokens: number;
  phase1PassRate: number;
  phase2PassRate: number;
  phase3PassRate: number;
  phase4PassRate: number;
  phase5PassRate: number;
  pendingVerifications: number;
  totalClaimableRewards: string;
}

export interface PendingVerification {
  tokenId: string;
  phase: 1 | 2 | 3 | 4 | 5;
  submitter: string;
  submittedAt: number;
  cid: string;
  dataHash: string;
}

export const PHASE_NAMES = {
  1: "Farming",
  2: "Harvest",
  3: "Packing",
  4: "Logistics",
  5: "Retail"
} as const;

export const ROLE_NAMES = {
  FARMER_ROLE: "Farmer",
  PACKER_ROLE: "Packer",
  LOGISTICS_ROLE: "Logistics",
  RETAIL_ROLE: "Retailer",
  ADMIN_ROLE: "Admin"
} as const;

// 角色哈希必须与合约中的 keccak256("ROLE_NAME") 结果匹配
// 这些是通过 ethers.keccak256(ethers.toUtf8Bytes("ROLE_NAME")) 计算的正确值
export const ROLES = {
  ADMIN_ROLE: "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775", // keccak256("ADMIN_ROLE")
  FARMER_ROLE: "0x7c6181838a71a779e445600d4c6ecbe16bacf2b3c5bda69c29fada66d1b645d1", // keccak256("FARMER_ROLE")
  PACKER_ROLE: "0xbbeb06fd03872d7638a0786a77ffe47a2b14e1704b5e459ed8a2c15237f422de", // keccak256("PACKER_ROLE") 
  LOGISTICS_ROLE: "0xded9b5e0e0e3a2b3f09a0bc36ec64b9bf7a7c2319f3c4d9cff5ce48714257b21", // keccak256("LOGISTICS_ROLE")
  RETAIL_ROLE: "0x199c42b34ecb446db8751bea4ac1ef9f0e5aa59d46d19ef2e28619bcbb339717" // keccak256("RETAIL_ROLE")
} as const;

export const PHASE_ROLES = {
  1: "FARMER_ROLE",
  2: "FARMER_ROLE", 
  3: "PACKER_ROLE",
  4: "LOGISTICS_ROLE",
  5: "RETAIL_ROLE",
} as const;
