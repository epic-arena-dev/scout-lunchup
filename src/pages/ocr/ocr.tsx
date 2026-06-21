import { useState, useCallback } from "react"
import { View, Text, Button, Image, ScrollView } from "@tarojs/components"
import Taro, { useLoad } from "@tarojs/taro"
import { t } from "@/i18n"
import { apiPost, apiUpload } from "@/lib/api"
import type { OcrResult } from "@/types"
import "./ocr.scss"

type Step = "capture" | "preview" | "processing" | "result"

const OCR_FIELDS = [
  { key: "project_name", label: "ocr.projectName" as const },
  { key: "project_number", label: "ocr.projectNumber" as const },
  { key: "deadline", label: "ocr.deadline" as const },
  { key: "budget", label: "ocr.budget" as const },
  { key: "purchaser", label: "ocr.purchaser" as const },
  { key: "bidding_agency", label: "ocr.agency" as const },
] as const

export default function OcrPage() {
  const [step, setStep] = useState<Step>("capture")
  const [imagePath, setImagePath] = useState("")
  const [result, setResult] = useState<OcrResult | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState("")

  useLoad(() => {
    setStep("capture")
    setImagePath("")
    setResult(null)
    setError("")
  })

  // Step 1: Capture or choose image
  const handleTakePhoto = useCallback(() => {
    Taro.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["camera"],
      success: (res) => {
        setImagePath(res.tempFilePaths[0])
        setStep("preview")
        setError("")
      },
      fail: (e) => {
        if (e.errMsg.includes("cancel")) return
        setError(t("ocr.captureFailed"))
      },
    })
  }, [])

  const handleChooseAlbum = useCallback(() => {
    Taro.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album"],
      success: (res) => {
        setImagePath(res.tempFilePaths[0])
        setStep("preview")
        setError("")
      },
      fail: (e) => {
        if (e.errMsg.includes("cancel")) return
        setError(t("ocr.captureFailed"))
      },
    })
  }, [])

  // Step 2: Confirm and process
  const handleProcess = useCallback(async () => {
    if (!imagePath) return
    setStep("processing")
    setUploadProgress(0)
    setError("")

    try {
      // 1. Upload image
      const uploadResult = await apiUpload(imagePath, {}, (p) => setUploadProgress(p))
      const fileId = uploadResult.file_id

      // 2. Call OCR analysis
      const ocrResult = await apiPost<{ success: boolean; data: OcrResult }>(
        "/api/ocr/analyze",
        { file_id: fileId },
      )

      if (ocrResult.success && ocrResult.data) {
        setResult(ocrResult.data)
        setStep("result")
      } else {
        throw new Error(t("ocr.analyzeFailed"))
      }
    } catch (e: unknown) {
      setError((e as Error).message || t("ocr.analyzeFailed"))
      setStep("preview")
    }
  }, [imagePath])

  const handleRetake = useCallback(() => {
    setImagePath("")
    setStep("capture")
    setError("")
  }, [])

  const handleNewScan = useCallback(() => {
    setImagePath("")
    setResult(null)
    setStep("capture")
    setError("")
  }, [])

  const getFieldValue = (key: string): string => {
    if (!result) return ""
    const v = (result as Record<string, unknown>)[key]
    return typeof v === "string" ? v : ""
  }

  // ---- Step: Capture ----
  if (step === "capture") {
    return (
      <View className="page">
        <View className="ocr-scanner">
          {/* Viewfinder overlay */}
          <View className="viewfinder">
            <View className="viewfinder-frame">
              <View className="corner tl" />
              <View className="corner tr" />
              <View className="corner bl" />
              <View className="corner br" />
              <Text className="viewfinder-hint">{t("ocr.scanHint")}</Text>
            </View>
          </View>

          {/* Camera icon placeholder */}
          <View className="camera-icon">
            <View className="camera-body">
              <View className="camera-lens" />
            </View>
          </View>

          {error && (
            <View className="error-banner">
              <Text>{error}</Text>
            </View>
          )}

          {/* Action buttons */}
          <View className="capture-actions">
            <Button className="btn-camera" onClick={handleTakePhoto}>
              <Text className="btn-icon">📷</Text>
              <Text>{t("ocr.takePhoto")}</Text>
            </Button>
            <Button className="btn-album" onClick={handleChooseAlbum}>
              <Text className="btn-icon">🖼️</Text>
              <Text>{t("ocr.chooseAlbum")}</Text>
            </Button>
          </View>

          <Text className="capture-tip">{t("ocr.captureTip")}</Text>
        </View>
      </View>
    )
  }

  // ---- Step: Preview ----
  if (step === "preview") {
    return (
      <View className="page">
        <View className="preview-section">
          <Text className="section-title">{t("ocr.previewTitle")}</Text>
          <View className="preview-image-wrap">
            <Image className="preview-image" src={imagePath} mode="aspectFit" />
          </View>
          <View className="preview-actions">
            <Button className="btn-outline" onClick={handleRetake}>
              {t("ocr.retake")}
            </Button>
            <Button className="btn-primary" onClick={handleProcess}>
              {t("ocr.startScan")}
            </Button>
          </View>
        </View>
      </View>
    )
  }

  // ---- Step: Processing ----
  if (step === "processing") {
    return (
      <View className="page">
        <View className="processing-section">
          <View className="processing-spinner">
            <View className="spinner-ring" />
            <View className="spinner-inner" />
          </View>
          <Text className="processing-title">{t("ocr.processing")}</Text>
          <Text className="processing-hint">
            {t("ocr.uploadingHint", { percent: uploadProgress })}
          </Text>
          {/* Progress bar */}
          <View className="progress-track">
            <View
              className="progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </View>
          <Text className="processing-sub">{t("ocr.analyzingHint")}</Text>
        </View>
      </View>
    )
  }

  // ---- Step: Result ----
  return (
    <View className="page">
      <ScrollView className="result-scroll" scrollY>
        <View className="result-header">
          <Text className="result-icon">✅</Text>
          <Text className="result-title">{t("ocr.resultTitle")}</Text>
          <Text className="result-confidence">
            {t("ocr.confidence", { score: result ? Math.round(result.confidence * 100) : 0 })}
          </Text>
        </View>

        {/* Extracted fields */}
        <View className="result-fields">
          {OCR_FIELDS.map(({ key, label }) => {
            const value = getFieldValue(key)
            if (!value) return null
            return (
              <View key={key} className="field-card">
                <Text className="field-label">{t(label)}</Text>
                <Text className="field-value" selectable>
                  {value}
                </Text>
              </View>
            )
          })}
        </View>

        {/* Raw text section */}
        {result?.raw_text && (
          <View className="raw-text-section">
            <Text className="section-title">{t("ocr.rawText")}</Text>
            <View className="raw-text-card">
              <Text className="raw-text-content" selectable>
                {result.raw_text}
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View className="result-actions">
          <Button className="btn-outline" onClick={handleNewScan}>
            {t("ocr.newScan")}
          </Button>
          <Button
            className="btn-primary"
            onClick={() => Taro.navigateBack()}
          >
            {t("ocr.done")}
          </Button>
        </View>
      </ScrollView>
    </View>
  )
}
