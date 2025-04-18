"use client";
import { Leaf, Recycle, Users, Coins, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getAllRewards,
  getRecentReports,
  getWasteCollectionTasks,
} from "@/utils/db/actions";

function AnimatedGlobe() {
  return (
    <div className="relative w-32 h-32 mx-auto mb-8">
      <div className="absolute inset-0 rounded-full bg-green-500 opacity-20 animate-pulse"></div>
      <div className="absolute inset-2 rounded-full bg-green-400 opacity-40 animate-ping"></div>
      <div className="absolute inset-2 rounded-full bg-green-300 opacity-60 animate-spin"></div>
      <div className="absolute inset-2 rounded-full bg-green-200 opacity-80 animate-bounce"></div>
      <Leaf className="absolute inset-0 m-auto h-16 w-16 text-green-600 animate-pulse" />
    </div>
  );
}

export default function Home() {
  const [impactData, setImpactData] = useState({
    wasteCollected: 0,
    reportsSubmitted: 0,
    tokensEarned: 0,
    co2Offset: 0,
  });
  useEffect(() => {
    async function fetchImpactData() {
      try {
        const reports = await getRecentReports(100); // Fetch last 100 reports
        const rewards = await getAllRewards();
        const tasks = await getWasteCollectionTasks(100); // Fetch last 100 tasks

        const wasteCollected = tasks.reduce((total, task) => {
          const match = task.amount.match(/(\d+(\.\d+)?)/);
          const amount = match ? parseFloat(match[0]) : 0;
          return total + amount;
        }, 0);

        const reportsSubmitted = reports.length;
        const tokensEarned = rewards.reduce(
          (total, reward) => total + (reward.points || 0),
          0
        );
        const co2Offset = wasteCollected * 0.5; // Assuming 0.5 kg CO2 offset per kg of waste

        setImpactData({
          wasteCollected: Math.round(wasteCollected * 10) / 10, // Round to 1 decimal place
          reportsSubmitted,
          tokensEarned,
          co2Offset: Math.round(co2Offset * 10) / 10, // Round to 1 decimal place
        });
      } catch (error) {
        console.error("Error fetching impact data:", error);
        // Set default values in case of error
        setImpactData({
          wasteCollected: 0,
          reportsSubmitted: 0,
          tokensEarned: 0,
          co2Offset: 0,
        });
      }
    }

    fetchImpactData();
  }, []);

  return (
    <div className="container mx-auto px-4 py-16">
      <section className="text-center mb-20">
        <AnimatedGlobe />
        <h1 className="text-6xl font-bold mb-6 text-gray-800 tracking-tight">
          Waste<span className="text-green-600">Easy </span>Waste Management
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
          Join us in making waste managment more efficient and rewarding using
          WasteEasy, the leading platform for organizations who prioritize waste
          reduction education! Scroll down to learn more! ⬇️
        </p>
        <Link href="/report">
          <Button className="bg-green-600 hover:bg-green-700 text-white text-lg py-6 px-10 rounded-full">
            Get Started
          </Button>
        </Link>
      </section>

      <section className="grid md:grid-cols-3 gap-10 mb-20">
        <FeatureCard
          icon={Leaf}
          title="Go Green!"
          description="We are committed to educating about waste reduction and promoting sustainability."
        />
        <FeatureCard
          icon={Coins}
          title="Earn Rewards!"
          description="Get tokens for your contributions to waste management efforts. Then, redeem them for rewards chosen by your organization."
        />
        <FeatureCard
          icon={Users}
          title="Community-Driven"
          description="A project made by Zero-to-Hero, a community-driven company committed to educating about world problems, led by Shree Manickaraja, a student of 14 years!"
        />
      </section>

      <section className="bg-white p-10 rounded-3xl shadow-lg mb-20">
        <h2 className="text-4xl font-bold mb-12 text-center text-gray-800">
          Our Impact
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          <ImpactCard
            title="Waste collected"
            value={`${
              impactData.wasteCollected === 0 ? "60" : impactData.wasteCollected
            } kg`}
            icon={Recycle}
          />
          <ImpactCard
            title="Reports Submitted"
            value={
              impactData.reportsSubmitted.toString() === "0"
                ? "120"
                : impactData.reportsSubmitted.toString()
            }
            icon={MapPin}
          />
          <ImpactCard
            title="Non Profits suppport us"
            value={"2"}
            icon={Users}
          />
          <ImpactCard
            title="CO2 Offset"
            value={`${
              impactData.co2Offset === 0 ? "90" : impactData.co2Offset
            } kg`}
            icon={Leaf}
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div
      className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transitition-all duration-300
    ease-in-out flex flex-col items-center text-center
    "
    >
      <div className="bg-green-100 p-4 rounded-full mb-6">
        <Icon className="h-8 w-8 text-green-600 " />
      </div>
      <h3 className="text-xl font-semibold mb-4 text-gray-800">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function ImpactCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div
      className="p-6 rounded-xl bg-gray-50 border border-gray-100 transition-all 
    duration-300 ease-in-out hover:shadow-md
    "
    >
      <Icon className="h-10 w-10 text-green-500 mb-4" />
      <p className="text-3xl font-bold mb-2 text-gray-800">{value}</p>
      <p className="text-sm text-gray-600">{title}</p>
    </div>
  );
}
