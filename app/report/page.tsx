"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { MapPin, Upload, CheckCircle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  createReport,
  createUser,
  getRecentReports,
  getUserByEmail,
} from "@/utils/db/actions";

const geminiApiKey = process.env.GEMINI_API_KEY as any;

export default function ReportPage() {
  const [user, setUser] = useState("") as any;
  const router = useRouter();
  function capitalizeFirstLetter(word: any) {
    if (typeof word !== "string" || word.length === 0) {
      return word; // Handle non-string or empty input
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  const [reports, setReports] = useState<
    Array<{
      id: number;
      userId: number;
      location: string;
      wasteType: string;
      amount: string;
      createdAt: string;
    }>
  >([]);

  const [newReport, setNewReport] = useState({
    location: "",
    type: "",
    amount: "",
    bin: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verifying" | "success" | "failure"
  >("idle");

  const [verificationResult, setVerificationResults] = useState<{
    wasteType: string;
    quantity: string;
    confidence: number;
    bin: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const [searchBox, setSearchBox] =
    useState<google.maps.places.SearchBox | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNewReport({ ...newReport, [name]: value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
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

  const handleVerify = async () => {
    if (!file) return;

    setVerificationStatus("verifying");

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

      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();

      try {
        const cleanedText = text.replace(/```json|```/g, "").trim();
        const parsedResult = JSON.parse(cleanedText);
        if (
          parsedResult.wasteType &&
          parsedResult.quantity &&
          parsedResult.confidence &&
          parsedResult.bin
        ) {
          setVerificationResults(parsedResult);
          setVerificationStatus("success");
          setNewReport({
            ...newReport,
            type: parsedResult.wasteType,
            amount: parsedResult.quantity,
            bin: parsedResult.bin,
          });
        } else {
          console.error("Invalid verification results", parsedResult);
          setVerificationStatus("failure");
        }
      } catch (e) {
        console.error("Failed to parse JSON responses", e);
        setVerificationStatus("failure");
        toast.error("Something went wrong. Please try again later.");
      }
    } catch (e) {
      console.error("Error verifying waste", e);
      setVerificationStatus("failure");
      toast.error("Something went wrong. Please try again later.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationStatus !== "success") {
      toast.error("Please verify the waste before submitting");
    } else if (!user) {
      toast.error("Please log in before submitting");
      return;
    }

    setIsSubmitting(true);

    try {
      if (file) {
        console.log("User:", user);

        console.log(user.id);
        const report = (await createReport(
          user.id,
          newReport.location,
          newReport.type,
          newReport.amount,
          preview || undefined,
          verificationResult ? JSON.stringify(verificationResult) : undefined
        )) as any;
        //changed from any to any
        if (!report) {
          throw new Error(
            "Failed to create report: report is null or undefined"
          );
        }
        const formattedReport = {
          id: report.id,
          userId: report.userId,
          location: report.location,
          wasteType: report.wasteType,
          amount: report.amount,
          createdAt: report.createdAt.toDateString().split("T")[0],
        };

        setReports([formattedReport, ...reports]);
        setNewReport({ location: "", type: "", amount: "", bin: "" });
        setFile(null);
        setPreview(null);
        setVerificationStatus("idle");
        setVerificationResults(null);
        setSubmissionSuccess(true);
      }
    } catch (e) {
      console.error("Error creating report", e);
      toast.error("Failed to submit report. Please try again!");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const email = localStorage.getItem("userEmail");
      if (email) {
        let user = await getUserByEmail(email);
        if (!user) {
          user = await createUser(email, "Anonymous User");
        }
        setUser(user);

        if (user) {
          const recentReports = await getRecentReports();
          //changed from any to any
          const formattedReports = recentReports?.map((report: any) => ({
            ...report,
            createdAt: report.createdAt.toDateString().split("T")[0],
          }));
          setReports(formattedReports);
        } else {
          toast.error(
            "You must be logged in to submit a report. Log in then try again!"
          );
          router.push("/");
        }
      }
    };
    checkUser();
  }, [router]);

  if (submissionSuccess) {
    return (
      <div className="px-4 py-6 sm:p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-green-100 p-6 rounded-full mb-6">
          <CheckCircle className="w-16 h-16 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold mb-4 text-gray-800">
          Report Submitted Successfully!
        </h1>
        <p className="text-gray-600 mb-8 max-w-md">
          Thank you for helping keep our community clean. Your report has been
          submitted and will be reviewed shortly.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Button
            onClick={() => setSubmissionSuccess(false)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl"
          >
            Report Another
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-green-600 text-green-600 hover:bg-green-50 py-3 rounded-xl"
            onClick={() => {
              const shareData = {
                title: "I reported waste using WasteEasy!",
                text: "I just reported waste using WasteEasy! Join me in making our world cleaner.",
                url: window.location.origin,
              };
              if (navigator.share) {
                navigator
                  .share(shareData)
                  .then(() => console.log("Shared successfully"))
                  .catch((error) => console.log("Error sharing", error));
              } else {
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  shareData.text
                )}&url=${encodeURIComponent(shareData.url)}`;
                window.open(twitterUrl, "_blank");
              }
            }}
          >
            <Upload className="w-5 h-5 mr-2" />
            Share Report
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">
        Report Waste
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-4 sm:p-8 rounded-3xl shadow-lg mb-8 sm:mb-12"
      >
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
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload from device
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleOpenCamera}
                >
                  Take a photo
                </Button>
              </div>
              <p className="text-gray-700">
                Make sure you can clearly see the waste for best results
              </p>
              <p className="text-gray-700">
                To pick it up, go to the litter cleanup page and submit a
                picture of the trash again!⬅️
              </p>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            id="waste-image-upload"
            name="waste-image-upload"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*"
          />
          <input
            ref={cameraInputRef}
            id="waste-image-camera"
            name="waste-image-camera"
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
          onClick={handleVerify}
          className="w-full mb-8 bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg rounded-xl transition-colors duration-300"
          disabled={!file || verificationStatus === "verifying"}
        >
          {verificationStatus === "verifying" ? (
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Verifying...
            </>
          ) : (
            "Verify Waste"
          )}
        </Button>
        {verificationStatus === "success" && verificationResult && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-8 rounded-r-xl">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-400 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-green-800">
                  Verification Successful
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Waste Type: {verificationResult.wasteType}</p>
                  <p>Quantity: {verificationResult.quantity}</p>
                  <p className="font-bold">
                    Bin: {capitalizeFirstLetter(verificationResult.bin)}
                  </p>
                  <p>
                    Confidence:{" "}
                    {(verificationResult.confidence * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={newReport.location}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
              placeholder="Enter waste location"
            />
          </div>

          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Waste Type
            </label>
            <input
              type="text"
              id="type"
              name="type"
              value={newReport.type}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
              placeholder="Verified waste type"
              readOnly
            />
          </div>
          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Estimated Amount
            </label>
            <input
              type="text"
              id="amount"
              name="amount"
              value={newReport.amount}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
              placeholder="Verified amount"
              readOnly
            />
          </div>
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
        <Button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg rounded-xl transition-colors duration-300 flex items-center justify-center"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Submitting...
            </>
          ) : (
            "Submit Report"
          )}
        </Button>
      </form>
      <h2 className="text-3xl font-semibold mb-6 text-gray-800">
        Recent Reports
      </h2>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  UserID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-gray-50 transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <MapPin className="inline-block w-4 h-4 mr-2 text-green-500" />
                    {report.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.wasteType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.amount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.createdAt}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.userId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
