"use client";

import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/toaster";
import Link from "next/link";
import Image from "next/image";
import { 
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
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white">
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
            <Image 
              src="/durian-logo.png" 
              alt="Durian" 
              width={120} 
              height={120}
              priority
            />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Durian Supply Chain Management System
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Blockchain-based transparent, trustworthy, and traceable durian supply chain platform
          </p>
          <p className="text-lg text-gray-500 mt-4">
            From Tree to Table, Verified on Chain.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Link href="/roles">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-500">
              <Shield className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Role Management</h3>
              <p className="text-gray-600">Manage permissions for system participants</p>
            </Card>
          </Link>

          <Link href="/dashboard">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-500">
              <BarChart3 className="h-12 w-12 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Dashboard</h3>
              <p className="text-gray-600">View statistics and pending verifications</p>
            </Card>
          </Link>

          <Link href="/submit/farming">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-500">
              <Upload className="h-12 w-12 text-green-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Data Submission</h3>
              <p className="text-gray-600">Submit supply chain data for each phase</p>
            </Card>
          </Link>

          <Link href="/verify">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-orange-500">
              <CheckCircle className="h-12 w-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Data Verification</h3>
              <p className="text-gray-600">Verify pending supply chain data</p>
            </Card>
          </Link>
        </div>

        {/* Features Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Five-Phase Supply Chain Process</h2>
          <div className="grid md:grid-cols-5 gap-4">
            <Link href="/submit/farming">
              <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-500">
                <div className="flex justify-center mb-4">
                  <div className="bg-green-100 p-4 rounded-full">
                    <span className="text-3xl">🌱</span>
                  </div>
                </div>
                <h3 className="font-bold mb-2">Phase 1</h3>
                <p className="text-sm text-gray-600">Farming</p>
                <p className="text-xs text-gray-500 mt-2">IoT monitoring, fertilization records</p>
              </Card>
            </Link>

            <Link href="/submit/harvest">
              <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-yellow-500">
                <div className="flex justify-center mb-4">
                  <div className="bg-yellow-100 p-4 rounded-full">
                    <span className="text-3xl">✂️</span>
                  </div>
                </div>
                <h3 className="font-bold mb-2">Phase 2</h3>
                <p className="text-sm text-gray-600">Harvest</p>
                <p className="text-xs text-gray-500 mt-2">Weight, quality inspection</p>
              </Card>
            </Link>

            <Link href="/submit/packing">
              <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-500">
                <div className="flex justify-center mb-4">
                  <div className="bg-blue-100 p-4 rounded-full">
                    <Package className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                <h3 className="font-bold mb-2">Phase 3</h3>
                <p className="text-sm text-gray-600">Packing</p>
                <p className="text-xs text-gray-500 mt-2">QA testing, batch management</p>
              </Card>
            </Link>

            <Link href="/submit/logistics">
              <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-500">
                <div className="flex justify-center mb-4">
                  <div className="bg-purple-100 p-4 rounded-full">
                    <Truck className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
                <h3 className="font-bold mb-2">Phase 4</h3>
                <p className="text-sm text-gray-600">Logistics</p>
                <p className="text-xs text-gray-500 mt-2">Temperature monitoring, route tracking</p>
              </Card>
            </Link>

            <Link href="/submit/retail">
              <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-orange-500">
                <div className="flex justify-center mb-4">
                  <div className="bg-orange-100 p-4 rounded-full">
                    <Store className="h-8 w-8 text-orange-600" />
                  </div>
                </div>
                <h3 className="font-bold mb-2">Phase 5</h3>
                <p className="text-sm text-gray-600">Retail</p>
                <p className="text-xs text-gray-500 mt-2">Store information, pricing</p>
              </Card>
            </Link>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-3xl font-bold text-center mb-8">Platform Advantages</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-xl mb-2">Transparent & Trustworthy</h3>
              <p className="text-gray-600">
                All data stored on-chain, immutable, ensuring authentic and reliable supply chain information
              </p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-bold text-xl mb-2">Full Traceability</h3>
              <p className="text-gray-600">
                Scan QR code to view complete supply chain information from farm to table
              </p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-xl mb-2">Smart Incentives</h3>
              <p className="text-gray-600">
                Automated reward mechanism based on smart contracts to incentivize all participants
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-gray-600 mb-8">
            First, connect your wallet and assign role permissions
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/roles">
              <Button size="lg" className="text-lg px-8">
                Get Started
              </Button>
            </Link>
            <Link href="/track/1">
              <Button size="lg" variant="outline" className="text-lg px-8">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2025 Durian Supply Chain Management System | Built on Blockchain Technology
          </p>
        </div>
      </footer>
    </div>
  );
}
