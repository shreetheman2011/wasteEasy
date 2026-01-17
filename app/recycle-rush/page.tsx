"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Recycle,
  Trash2,
  Leaf,
  Play,
  RotateCcw,
  Trophy,
  Check,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  getUserByEmail,
  updateRewardPoints,
  createTransaction,
} from "@/utils/db/actions";

// Game types and data
type WasteType = "recycle" | "trash" | "compost";

interface WasteItem {
  id: number;
  name: string;
  type: WasteType;
  emoji: string;
}

const WASTE_ITEMS: WasteItem[] = [
  { id: 1, name: "Plastic Bottle", type: "recycle", emoji: "🧴" },
  { id: 2, name: "Banana Peel", type: "compost", emoji: "🍌" },
  { id: 3, name: "Soda Can", type: "recycle", emoji: "🥤" },
  { id: 4, name: "Apple Core", type: "compost", emoji: "🍎" },
  { id: 5, name: "Crisp Packet", type: "trash", emoji: "🥡" },
  { id: 6, name: "Paper", type: "recycle", emoji: "📄" },
  { id: 7, name: "Glass Jar", type: "recycle", emoji: "🫙" },
  { id: 8, name: "Pizza Box (Greasy)", type: "compost", emoji: "🍕" }, // Depends on locale, but often compost/trash
  { id: 9, name: "Styrofoam", type: "trash", emoji: "🥡" },
  { id: 10, name: "Egg Shells", type: "compost", emoji: "🥚" },
  { id: 11, name: "Cardboard", type: "recycle", emoji: "📦" },
  { id: 12, name: "Plastic Bag", type: "trash", emoji: "🛍️" },
];

export default function RecycleRushPage() {
  const [gameState, setGameState] = useState<
    "start" | "playing" | "gameover" | "levelcomplete"
  >("start");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentItems, setCurrentItems] = useState<WasteItem[]>([]);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<WasteItem | null>(null);

  // Load user and high score
  useEffect(() => {
    const init = async () => {
      const email = localStorage.getItem("userEmail");
      if (email) {
        const u = await getUserByEmail(email);
        setUser(u);
      }
      const storedHighScore = localStorage.getItem("recycleRushHighScore");
      if (storedHighScore) {
        setHighScore(parseInt(storedHighScore));
      }
    };
    init();
  }, []);

  // Timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === "playing" && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && gameState === "playing") {
      endGame();
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  const startGame = () => {
    setGameState("playing");
    setScore(0);
    setTimeLeft(60);
    setLevel(1);
    spawnItems(5);
  };

  const spawnItems = (count: number) => {
    const newItems: WasteItem[] = [];
    for (let i = 0; i < count; i++) {
      const randomItem =
        WASTE_ITEMS[Math.floor(Math.random() * WASTE_ITEMS.length)];
      newItems.push({ ...randomItem, id: Date.now() + i });
    }
    setCurrentItems(newItems);
  };

  const endGame = async () => {
    setGameState("gameover");
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem("recycleRushHighScore", score.toString());
    }

    // Award tokens for playing (1 token per 100 points)
    if (user && score > 0) {
      const tokensEarned = Math.floor(score / 10); // 1 token per 10 points for more gratification
      if (tokensEarned > 0) {
        try {
          await updateRewardPoints(user.id, tokensEarned);
          await createTransaction(
            user.id,
            "earned_report", // Using existing type, ideally "earned_game"
            tokensEarned,
            `Earned from Recycle Rush (Score: ${score})`
          );
          toast.success(`You earned ${tokensEarned} tokens!`);
        } catch (error) {
          console.error("Error awarding tokens:", error);
        }
      }
    }
  };

  const handleBinClick = (binType: WasteType) => {
    if (!selectedItem) return;

    if (selectedItem.type === binType) {
      setScore((prev) => prev + 10 + level * 2);
      toast.custom(
        (t) => (
          <div className="bg-green-500 text-white px-4 py-2 rounded-full flex items-center shadow-lg">
            <Check className="w-4 h-4 mr-2" /> Correct! +
            {10 + level * 2}
          </div>
        ),
        { duration: 1000 }
      );

      // Remove item and check level progress
      const remaining = currentItems.filter((i) => i.id !== selectedItem.id);
      setCurrentItems(remaining);
      setSelectedItem(null);

      if (remaining.length === 0) {
        if (level < 5) {
          setLevel((prev) => prev + 1);
          spawnItems(5 + level); // Increase difficulty
          setTimeLeft((prev) => prev + 10); // Bonus time
          toast.success("Level Up! +10s");
        } else {
          // Endless mode or just respawn
          spawnItems(8);
          setTimeLeft((prev) => prev + 15);
        }
      }
    } else {
      setScore((prev) => Math.max(0, prev - 5));
      setTimeLeft((prev) => Math.max(0, prev - 2)); // Penalty
      toast.custom(
        (t) => (
          <div className="bg-red-500 text-white px-4 py-2 rounded-full flex items-center shadow-lg">
            <X className="w-4 h-4 mr-2" /> Wrong Bin! -5 pts
          </div>
        ),
        { duration: 1000 }
      );
      setSelectedItem(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl min-h-screen flex flex-col">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Recycle Rush</h1>
        <p className="text-gray-600">
          Sort the waste correctly before time runs out!
        </p>
      </div>

      {gameState === "start" && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-3xl shadow-xl p-10 text-center">
          <Recycle className="w-24 h-24 text-green-500 mb-6 animate-bounce" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Ready to Recycle?
          </h2>
          <p className="text-gray-600 mb-8 max-w-md">
            Tap an item to pick it up, then tap the correct bin to sort it. Earn
            points and tokens for your accuracy!
          </p>
          <Button
            onClick={startGame}
            className="bg-green-600 hover:bg-green-700 text-white text-xl py-6 px-10 rounded-full flex items-center"
          >
            <Play className="mr-2 w-6 h-6" /> Start Game
          </Button>
          {highScore > 0 && (
            <div className="mt-8 flex items-center text-yellow-600">
              <Trophy className="w-5 h-5 mr-2" />
              <span className="font-semibold">High Score: {highScore}</span>
            </div>
          )}
        </div>
      )}

      {gameState === "playing" && (
        <div className="flex-1 flex flex-col">
          {/* HUD */}
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-md mb-6">
            <div className="flex items-center space-x-4">
              <div className="text-gray-700">
                <span className="font-bold">Level:</span> {level}
              </div>
              <div className="text-gray-700">
                <span className="font-bold">Score:</span> {score}
              </div>
            </div>
            <div
              className={`text-xl font-bold ${
                timeLeft < 10 ? "text-red-500 animate-pulse" : "text-gray-700"
              }`}
            >
              Time: {timeLeft}s
            </div>
          </div>

          {/* Game Area */}
          <div className="flex-1 bg-blue-50 rounded-3xl p-6 mb-6 relative min-h-[300px] flex flex-wrap content-center justify-center gap-4">
            {currentItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`transform transition-all duration-200 p-4 rounded-xl bg-white shadow-md text-4xl hover:scale-110 active:scale-95 ${
                  selectedItem?.id === item.id
                    ? "ring-4 ring-green-400 scale-110 shadow-xl z-10"
                    : ""
                }`}
              >
                {item.emoji}
                <span className="block text-xs mt-2 text-gray-500 font-medium">
                  {item.name}
                </span>
              </button>
            ))}
          </div>

          {/* Bins */}
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => handleBinClick("recycle")}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-200 ${
                selectedItem
                  ? "bg-blue-100 border-2 border-blue-400 hover:bg-blue-200 cursor-pointer"
                  : "bg-gray-100 opacity-50 cursor-default"
              }`}
            >
              <Recycle className="w-12 h-12 text-blue-600 mb-2" />
              <span className="font-bold text-blue-800">Recycle</span>
            </button>
            <button
              onClick={() => handleBinClick("compost")}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-200 ${
                selectedItem
                  ? "bg-green-100 border-2 border-green-400 hover:bg-green-200 cursor-pointer"
                  : "bg-gray-100 opacity-50 cursor-default"
              }`}
            >
              <Leaf className="w-12 h-12 text-green-600 mb-2" />
              <span className="font-bold text-green-800">Compost</span>
            </button>
            <button
              onClick={() => handleBinClick("trash")}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-200 ${
                selectedItem
                  ? "bg-red-100 border-2 border-red-400 hover:bg-red-200 cursor-pointer"
                  : "bg-gray-100 opacity-50 cursor-default"
              }`}
            >
              <Trash2 className="w-12 h-12 text-red-600 mb-2" />
              <span className="font-bold text-red-800">Trash</span>
            </button>
          </div>
        </div>
      )}

      {gameState === "gameover" && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-3xl shadow-xl p-10 text-center">
          <Trophy className="w-24 h-24 text-yellow-500 mb-6" />
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Game Over!</h2>
          <p className="text-2xl font-bold text-green-600 mb-6">
            Final Score: {score}
          </p>
          <div className="bg-gray-100 rounded-xl p-4 mb-8 w-full max-w-sm">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Items Sorted</span>
              <span className="font-bold">{Math.floor(score / 10)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tokens Earned</span>
              <span className="font-bold text-yellow-600">
                +{Math.floor(score / 10)}
              </span>
            </div>
          </div>
          <Button
            onClick={startGame}
            className="bg-green-600 hover:bg-green-700 text-white text-xl py-6 px-10 rounded-full flex items-center"
          >
            <RotateCcw className="mr-2 w-6 h-6" /> Play Again
          </Button>
        </div>
      )}
    </div>
  );
}
