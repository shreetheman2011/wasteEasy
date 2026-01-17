"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Camera, Loader, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { toast } from "react-hot-toast";

const geminiApiKey = process.env.GEMINI_API_KEY as any;

type AnalysisResult = {
  wasteType: string;
  quantity: string;
  confidence: number;
  bin: string;
};

export default function BinHelperPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "verifying" | "success" | "failure"
  >("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
      setResult(null);
      setStatus("idle");
    }
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (showCamera) {
      const initCamera = async () => {
        try {
          if (typeof navigator !== "undefined" && navigator.mediaDevices) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: "environment" },
            });
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
            }
          }
        } catch (error) {
          console.error("Error accessing camera:", error);
          setShowCamera(false);
          cameraInputRef.current?.click();
        }
      };
      initCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showCamera]);

  const handleOpenCamera = () => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      setShowCamera(true);
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handleCloseCamera = () => {
    setShowCamera(false);
  };

  const handleCapturePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg");
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const capturedFile = new File([blob], "captured.jpg", {
      type: blob.type || "image/jpeg",
    });
    setFile(capturedFile);
    setPreview(dataUrl);
    setResult(null);
    setStatus("idle");
    handleCloseCamera();
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const formatBin = (bin: string) => {
    if (typeof bin !== "string" || bin.length === 0) {
      return bin;
    }
    return bin.charAt(0).toUpperCase() + bin.slice(1);
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("Please upload or take a photo first.");
      return;
    }

    setStatus("verifying");

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const base64Data = await readFileAsBase64(file);

      const imageParts = [
        {
          inlineData: {
            data: base64Data.split(",")[1],
            mimeType: file.type,
          },
        },
      ];

      const prompt = `You are an expert in waste management and recycling. Analyze this image and provide:
        1. The type of waste (e.g., plastic, paper, glass, metal, organic, etc.)
        2. An estimate of the quantity or amount (in kg or lb or liters)
        3. Your confidence level in this assessment (as a percentage)
        4. The bin it goes in(choose from: recyclables, landfill, and organics)

        DO NOT ENTER ANY OTHER WORDS FOR THE QUANTITY. ONLY 10 kg or 0.5 kg things like that. Not approximately.... Or do 0.5-10 kg.
        
        Respond in JSON format like this:
        {
          "wasteType": "type of waste",
          "quantity": "estimated quantity with unit",
          "confidence": confidence level as a number between 0 and 1,
          "bin": "bin name"
        }`;

      const resultResponse = await model.generateContent([
        prompt,
        ...imageParts,
      ]);
      const response = await resultResponse.response;
      const text = response.text();

      try {
        const cleanedText = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanedText);
        if (
          parsed.wasteType &&
          parsed.quantity &&
          typeof parsed.confidence === "number" &&
          parsed.bin
        ) {
          setResult(parsed);
          setStatus("success");
        } else {
          setStatus("failure");
          toast.error(
            "Could not understand the AI response. Please try again."
          );
        }
      } catch (e) {
        setStatus("failure");
        toast.error("Something went wrong. Please try again later.");
      }
    } catch (e) {
      setStatus("failure");
      toast.error("Something went wrong. Please try again later.");
    }
  };

  return (
    <div className="px-4 py-6 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">
        What Bin Does This Go In?
      </h1>

      <div className="bg-white p-4 sm:p-8 rounded-3xl shadow-lg mb-8">
        <p className="mb-4 text-gray-700">
          Take or upload a photo of any trash item, and our AI model trained on millions of real world data will help you
          decide which bin it should go in.
        </p>

        <div className="mb-8">
          <label className="block text-lg font-medium text-gray-700 mb-2">
            Waste Image
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-green-500 transition-colors duration-300">
            <div className="space-y-3 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-600">
                Choose how you want to add a photo of the trash
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  Upload from device
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                  onClick={handleOpenCamera}
                >
                  <Camera className="h-4 w-4" />
                  Take a photo
                </Button>
              </div>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
          </div>
          <input
            ref={uploadInputRef}
            id="bin-helper-upload"
            name="bin-helper-upload"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*"
          />
          <input
            ref={cameraInputRef}
            id="bin-helper-camera"
            name="bin-helper-camera"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
          />
        </div>

        {preview && (
          <div className="mt-4 mb-8">
            <img
              src={preview}
              alt="Waste preview"
              className="max-w-full h-auto rounded-xl shadow-md"
            />
          </div>
        )}

        <Button
          type="button"
          onClick={handleAnalyze}
          className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg rounded-xl transition-colors duration-300 flex items-center justify-center"
          disabled={!file || status === "verifying"}
        >
          {status === "verifying" ? (
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Analyzing...
            </>
          ) : (
            "Ask WasteEasy AI"
          )}
        </Button>

        {status === "success" && result && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4 rounded-r-xl">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-400 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-green-800">
                  Recommended Bin
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Waste Type: {result.wasteType}</p>
                  <p>Quantity: {result.quantity}</p>
                  <p className="font-bold">Bin: {formatBin(result.bin)}</p>
                  <p>Confidence: {(result.confidence * 100).toFixed(2)}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {status === "failure" && (
          <p className="mt-2 text-red-600 text-center text-sm">
            Could not analyze this image. Please try again with a clearer photo.
          </p>
        )}
      </div>
      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-4 w-full max-w-md">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-md mb-4"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleCapturePhoto}
              >
                Capture photo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleCloseCamera}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
