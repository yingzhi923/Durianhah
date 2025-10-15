/**
 * 缩短钱包地址显示
 */
export const shortenAddress = (address: string): string => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * 格式化时间戳为本地时间字符串
 */
export const formatTimestamp = (timestamp: number): string => {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * 格式化日期
 */
export const formatDate = (timestamp: number): string => {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Get countdown text
 */
export const getCountdown = (unlockTime: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const remaining = unlockTime - now;
  
  if (remaining <= 0) return "Unlocked";
  
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

/**
 * 获取阶段图标
 */
export const getPhaseIcon = (phase: number): string => {
  const icons = ["🌱", "✂️", "📦", "🚚", "🏪"];
  return icons[phase - 1] || "⚪";
};

/**
 * 获取状态图标
 */
export const getStatusIcon = (
  submitted: boolean,
  verified: boolean,
  claimed: boolean
): string => {
  if (claimed) return "✅";
  if (verified) return "🎯";
  if (submitted) return "⏳";
  return "⚪";
};

/**
 * Get status text
 */
export const getStatusText = (
  submitted: boolean,
  verified: boolean,
  claimed: boolean
): string => {
  if (claimed) return "Claimed";
  if (verified) return "Verified";
  if (submitted) return "Pending";
  return "Not Submitted";
};

/**
 * 格式化 Token 数量（从 Wei 转换）
 */
export const formatTokenAmount = (amount: bigint | string): string => {
  const amountBigInt = typeof amount === "string" ? BigInt(amount) : amount;
  const formatted = Number(amountBigInt) / 1e18;
  return formatted.toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

/**
 * 生成数据哈希（简化版，实际应使用 keccak256）
 */
export const generateDataHash = (data: any): string => {
  const dataString = JSON.stringify(data);
  const hash = "0x" + 
    Array.from(dataString)
      .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 64)
      .padEnd(64, '0');
  return hash;
};

/**
 * 生成模拟 IPFS CID
 */
export const generateMockCID = (): string => {
  return `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * 打包数据（将多个数字打包成一个 uint256）
 */
export const packData = (...values: number[]): string => {
  // 简化实现：将数字拼接
  // 实际应用中应该使用位运算
  let packed = BigInt(0);
  for (let i = 0; i < values.length; i++) {
    packed = (packed << BigInt(80)) | BigInt(Math.floor(values[i] * 100));
  }
  return packed.toString();
};

/**
 * 验证以太坊地址
 */
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * 验证数据哈希
 */
export const isValidDataHash = (hash: string): boolean => {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
};

/**
 * Extract readable message from error object
 */
export const getErrorMessage = (error: any): string => {
  if (typeof error === "string") return error;
  if (error?.message) return error.message;
  if (error?.reason) return error.reason;
  return "An unknown error occurred";
};
