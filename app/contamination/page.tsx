"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Camera, Loader, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { toast } from "react-hot-toast";

const geminiApiKey = process.env.GEMINI_API_KEY as any;

type ContaminationResult = {
  contaminationPercentage: number;
  contaminationSummary: string;
  confidence?: number;
  wasteType?: string;
  quantity?: string;
};

export default function ContaminationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "analyzing" | "success" | "failure"
  >("idle");
  const [result, setResult] = useState<ContaminationResult | null>(null);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedBin, setSelectedBin] = useState<
    "recyclables" | "landfill" | "organics"
  >("recyclables");

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

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("Please upload or take a photo first.");
      return;
    }

    setStatus("analyzing");

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

      const prompt = `You are an expert in waste management and recycling. The user is assessing contamination for the "${selectedBin}" bin. Analyze the image and estimate:
        1) contaminationPercentage: the fraction of visible items that do NOT belong in the "${selectedBin}" bin (a number between 0 and 1)
        2) contaminationSummary: a short sentence (max 20 words) describing the main contaminants
        Optionally include:
        3) confidence: number between 0 and 1
        4) wasteType: overall dominant waste type
        5) quantity: estimated quantity with unit
        
        Respond in pure JSON:
        {
          "contaminationPercentage": number,
          "contaminationSummary": "short description",
          "confidence": number,
          "wasteType": "string",
          "quantity": "string"
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
          typeof parsed.contaminationPercentage === "number" &&
          typeof parsed.contaminationSummary === "string"
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
        Bin Contamination Checker
      </h1>

      <div className="bg-white p-4 sm:p-8 rounded-3xl shadow-lg mb-8">
        <p className="mb-4 text-gray-700">
          Upload or take a photo of a bin, select the bin type, and our AI model
          trained on millions of real data points will estimate how much of the
          contents don’t belong there.
        </p>

        <div className="mb-6">
          <label
            htmlFor="bin-type"
            className="block text-lg font-medium text-gray-700 mb-2"
          >
            Bin Type
          </label>
          <select
            id="bin-type"
            value={selectedBin}
            onChange={(e) =>
              setSelectedBin(
                e.target.value as "recyclables" | "landfill" | "organics"
              )
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
          >
            <option value="recyclables">Recyclables</option>
            <option value="landfill">Landfill</option>
            <option value="organics">Organics</option>
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Used to estimate contamination level for this bin.
          </p>
        </div>

        <div className="mb-8">
          <label className="block text-lg font-medium text-gray-700 mb-2">
            Bin Image
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-green-500 transition-colors duration-300">
            <div className="space-y-3 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-600">
                Choose how you want to add a photo
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
            id="contamination-upload"
            name="contamination-upload"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*"
          />
          <input
            ref={cameraInputRef}
            id="contamination-camera"
            name="contamination-camera"
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
              alt="Bin preview"
              className="max-w-full h-auto rounded-xl shadow-md"
            />
          </div>
        )}

        <Button
          type="button"
          onClick={handleAnalyze}
          className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg rounded-xl transition-colors duration-300 flex items-center justify-center"
          disabled={!file || status === "analyzing"}
        >
          {status === "analyzing" ? (
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Analyzing...
            </>
          ) : (
            "Analyze Contamination"
          )}
        </Button>

        {status === "success" && result && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-r-xl">
            <div className="flex items-start">
              <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3 mt-0.5" />
              <div>
                <h3 className="text-lg font-medium text-yellow-800">
                  Contamination Result
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p className="font-bold">
                    {`Contamination for ${
                      selectedBin.charAt(0).toUpperCase() + selectedBin.slice(1)
                    }:`}{" "}
                    {(result.contaminationPercentage * 100).toFixed(0)}%
                  </p>
                  <p>Summary: {result.contaminationSummary}</p>
                  {typeof result.confidence === "number" && (
                    <p>Confidence: {(result.confidence * 100).toFixed(2)}%</p>
                  )}
                  {result.wasteType && (
                    <p>Dominant Waste Type: {result.wasteType}</p>
                  )}
                  {result.quantity && <p>Quantity: {result.quantity}</p>}
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
