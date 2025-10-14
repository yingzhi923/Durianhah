"use client";

import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/toaster";
import Link from "next/link";
import { 
  TreePine, 
  Shield, 
  Upload, 
  CheckCircle, 
  Search,
  BarChart3,
  Package,
  Truck,
  Store
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <Toaster />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Header />
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <TreePine className="h-20 w-20 text-green-600" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            榴莲供应链管理系统
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            基于区块链的透明、可信、可追溯的榴莲供应链管理平台
          </p>
          <p className="text-lg text-gray-500 mt-4">
            从农场到餐桌，每一步都清晰可见
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Link href="/roles">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-500">
              <Shield className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">角色管理</h3>
              <p className="text-gray-600">管理系统参与者的权限</p>
            </Card>
          </Link>

          <Link href="/dashboard">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-500">
              <BarChart3 className="h-12 w-12 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">管理控制台</h3>
              <p className="text-gray-600">查看统计数据和待核验项目</p>
            </Card>
          </Link>

          <Link href="/submit/farming">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-500">
              <Upload className="h-12 w-12 text-green-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">数据提交</h3>
              <p className="text-gray-600">提交各阶段供应链数据</p>
            </Card>
          </Link>

          <Link href="/verify">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-orange-500">
              <CheckCircle className="h-12 w-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">数据核验</h3>
              <p className="text-gray-600">核验待审批的供应链数据</p>
            </Card>
          </Link>
        </div>

        {/* Features Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">供应链五阶段流程</h2>
          <div className="grid md:grid-cols-5 gap-4">
            <Card className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-green-100 p-4 rounded-full">
                  <TreePine className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h3 className="font-bold mb-2">Phase 1</h3>
              <p className="text-sm text-gray-600">种植 (Farming)</p>
              <p className="text-xs text-gray-500 mt-2">IoT 监控、施肥记录</p>
            </Card>

            <Card className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-yellow-100 p-4 rounded-full">
                  <span className="text-3xl">✂️</span>
                </div>
              </div>
              <h3 className="font-bold mb-2">Phase 2</h3>
              <p className="text-sm text-gray-600">采摘 (Harvest)</p>
              <p className="text-xs text-gray-500 mt-2">重量、品质检测</p>
            </Card>

            <Card className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-blue-100 p-4 rounded-full">
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <h3 className="font-bold mb-2">Phase 3</h3>
              <p className="text-sm text-gray-600">包装 (Packing)</p>
              <p className="text-xs text-gray-500 mt-2">QA检测、批次管理</p>
            </Card>

            <Card className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-purple-100 p-4 rounded-full">
                  <Truck className="h-8 w-8 text-purple-600" />
                </div>
              </div>
              <h3 className="font-bold mb-2">Phase 4</h3>
              <p className="text-sm text-gray-600">物流 (Logistics)</p>
              <p className="text-xs text-gray-500 mt-2">温度监控、路线追踪</p>
            </Card>

            <Card className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-orange-100 p-4 rounded-full">
                  <Store className="h-8 w-8 text-orange-600" />
                </div>
              </div>
              <h3 className="font-bold mb-2">Phase 5</h3>
              <p className="text-sm text-gray-600">零售 (Retail)</p>
              <p className="text-xs text-gray-500 mt-2">门店信息、售价</p>
            </Card>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-3xl font-bold text-center mb-8">平台优势</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-xl mb-2">透明可信</h3>
              <p className="text-gray-600">
                所有数据上链存储，不可篡改，确保供应链信息真实可靠
              </p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-bold text-xl mb-2">全程追溯</h3>
              <p className="text-gray-600">
                扫码即可查看榴莲从农场到餐桌的完整供应链信息
              </p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-xl mb-2">智能激励</h3>
              <p className="text-gray-600">
                基于智能合约的自动奖励机制，激励各环节参与者
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <h2 className="text-2xl font-bold mb-4">准备开始了吗？</h2>
          <p className="text-gray-600 mb-8">
            首先需要连接钱包并分配角色权限
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/roles">
              <Button size="lg" className="text-lg px-8">
                开始使用
              </Button>
            </Link>
            <Link href="/track/1">
              <Button size="lg" variant="outline" className="text-lg px-8">
                查看演示
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2025 榴莲供应链管理系统 | 基于区块链技术构建
          </p>
        </div>
      </footer>
    </div>
  );
}
