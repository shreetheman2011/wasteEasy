"use client";

import { useState, useEffect } from "react";
import {
  getUserByEmail,
  getUnreadNotifications,
  getRewardTransactions,
  getUserBalance,
} from "@/utils/db/actions";
import {
  User,
  Mail,
  MapPin,
  Coins,
  Trophy,
  Calendar,
  Settings,
  LogOut,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail");
        if (userEmail) {
          const fetchedUser = await getUserByEmail(userEmail);
          setUser(fetchedUser);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userEmail");
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center mt-10">
        <h2 className="text-2xl font-bold mb-4">Please log in to view settings</h2>
        <Button onClick={() => (window.location.href = "/")}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Profile & Settings</h1>

      {/* User Profile Card */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <div className="flex items-center space-x-4 mb-6">
          <div className="bg-green-100 p-4 rounded-full">
            <User className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">{user.name}</h2>
            <p className="text-gray-500">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-4 rounded-xl flex items-center">
            <Calendar className="w-5 h-5 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="font-medium">
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl flex items-center">
            <Coins className="w-5 h-5 text-yellow-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Total Tokens Earned</p>
              <p className="font-medium">
                {/* Placeholder - would need to fetch total earned */}
                Active
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-6 flex items-center">
          <Trophy className="w-6 h-6 text-yellow-500 mr-2" />
          Achievements
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Achievement Card 1 */}
          <div className="border border-gray-200 rounded-xl p-4 hover:bg-green-50 transition-colors">
            <div className="flex items-center mb-2">
              <div className="bg-green-100 p-2 rounded-full mr-3">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-800">First Report</h3>
            </div>
            <p className="text-sm text-gray-600">Submitted your first waste report</p>
          </div>

          {/* Achievement Card 2 */}
          <div className="border border-gray-200 rounded-xl p-4 hover:bg-green-50 transition-colors">
            <div className="flex items-center mb-2">
              <div className="bg-green-100 p-2 rounded-full mr-3">
                <Trash2 className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-800">Cleaner</h3>
            </div>
            <p className="text-sm text-gray-600">Collected 10kg of waste</p>
          </div>
          
           {/* Achievement Card 3 */}
           <div className="border border-gray-200 rounded-xl p-4 hover:bg-green-50 transition-colors">
            <div className="flex items-center mb-2">
              <div className="bg-green-100 p-2 rounded-full mr-3">
                <Coins className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-800">Token Master</h3>
            </div>
            <p className="text-sm text-gray-600">Earned 1000 tokens</p>
          </div>
        </div>
      </div>

      {/* Account Actions */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center">
          <Settings className="w-6 h-6 text-gray-500 mr-2" />
          Account Settings
        </h2>
        
        <Button 
          variant="destructive" 
          onClick={handleLogout}
          className="w-full sm:w-auto"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
