import { useState, useRef, useEffect } from "react"
import { View, Text, Button, ScrollView } from "@tarojs/components"
import Taro, { useLoad, useDidHide } from "@tarojs/taro"
import { t } from "@/i18n"
import { apiGet, apiPost } from "@/lib/api"
import type { CheckResult, CollisionResult } from "@/types"
import "./analysis.scss"

export default function AnalysisPage() {
  const [results, setResults] = useState<CheckResult[]>([])
  const [collision, setCollision] = useState<CollisionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [animating, setAnimating] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [fileId, setFileId] = useState("")
  const cancelled = useRef(false)

  useDidHide(() => { cancelled.current = true })
  useEffect(() => () => { cancelled.current = true }, [])

  useLoad(({ fileId: fid, animating: anim }: { fileId?: string; animating?: string } = {}) => {
    if (fid) {
      setFileId(fid)
      if (anim === "true") {
        setAnimating(true)
        runAnalysis(fid)
      } else {
        loadAnalysis(fid)
      }
    }
  })

  const loadAnalysis = async (fid: string) => {
    try {
      const r = await apiGet<{ success: boolean; results: CheckResult[] }>(`/api/analyze/${fid}`)
      if (r.results?.length) {
        setResults(r.results)
        setLoading(false)
        loadCollision(fid)
        return
      }
    } catch { console.warn("analysis: no cached results") }
    await runAnalysis(fid)
  }

  const runAnalysis = async (fid: string) => {
    try {
      await apiPost("/api/analyze", { file_id: fid })
    } catch { console.warn("analysis: trigger") }

    for (let i = 0; i < 30; i++) {
      if (cancelled.current) return
      await new Promise((r) => setTimeout(r, 2000))
      if (cancelled.current) return
      try {
        const r = await apiGet<{ success: boolean; results: CheckResult[] }>(`/api/analyze/${fid}`)
        if (r.results?.length) {
          setResults(r.results)
          setAnimating(false)
          setLoading(false)
          loadCollision(fid)
          return
        }
      } catch { console.warn("analysis: poll retry") }
    }
    setAnimating(false)
    setLoading(false)
    Taro.showToast({ title: t("analysis.timeout"), icon: "none" })
  }

  const loadCollision = async (fid: string) => {
    try {
      const r = await apiGet<{ success: boolean; is_blocked: boolean; audit?: CollisionResult }>(
        `/api/collision/${fid}`,
      )
      if (r.is_blocked !== undefined) {
        setCollision(r.audit ? { ...r.audit, is_blocked: r.is_blocked } : null)
      }
    } catch { console.warn("analysis: collision check") }
  }

  const riskLevelLabel = (level: string) => {
    if (level === "critical") return t("analysis.critical")
    if (level === "high") return t("analysis.high")
    return t("analysis.pass")
  }

  const criticalCount = results.filter((r) => r.risk_level === "critical").length

  if (animating) {
    return (
      <View className="stickman-animation">
        <View className="flip-book">
          <View className="flip-page" />
        </View>
        <Text className="parsing-text">{t("analysis.analyzing")}</Text>
      </View>
    )
  }

  if (loading) return <View className="page-center"><Text>{t("common.loading")}</Text></View>

  return (
    <View className="page">
      <View className="summary-bar">
        <Text className="summary-text">
          {t("analysis.totalCheck", { count: results.length })}
          {criticalCount > 0 && ` ${t("analysis.criticalRisk", { count: criticalCount })}`}
        </Text>
        {results.length > 0 && (
          <>
            <Button className="btn-sm" onClick={async () => {
              setAnimating(true)
              await runAnalysis(fileId)
            }}>{t("analysis.reAnalyze")}</Button>
            <Button className="btn-sm primary" onClick={() => {
              Taro.navigateTo({ url: `/pages/bid/bid?fileId=${fileId}` })
            }}>{t("analysis.generateBid")}</Button>
          </>
        )}
      </View>

      {criticalCount > 0 && (
        <View className="shield-section">
          <View className="shield-icon" />
          <Text className="shield-message">{t("analysis.shieldMessage", { count: criticalCount })}</Text>
        </View>
      )}

      {collision && collision.is_blocked && (
        <View className="parse-result">
          <Text className="parse-title">{t("analysis.collisionFound")}</Text>
          {collision.extracted_name && (
            <Text className="parse-item">
              <Text className="parse-label">{t("analysis.projectName")}: </Text>
              {collision.extracted_name}
            </Text>
          )}
        </View>
      )}

      <ScrollView scrollY className="result-list">
        {results.map((r, i) => (
          <View
            key={r.check_item_id || i}
            className={`risk-card risk-${r.risk_level}`}
            onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
          >
            <View className="risk-card-header">
              <Text className={`risk-badge risk-badge-${r.risk_level}`}>
                {riskLevelLabel(r.risk_level)}
              </Text>
              <Text className="risk-title">{r.title}</Text>
            </View>
            {expandedIndex === i && (
              <View className="risk-detail">
                <View className="detail-section">
                  <Text className="detail-label">{t("analysis.riskDescription")}</Text>
                  <Text className="detail-text">{r.result}</Text>
                </View>
                {r.evidence && (
                  <View className="detail-section">
                    <Text className="detail-label">{t("analysis.legalBasis")}</Text>
                    <Text className="detail-text evidence">{r.evidence}</Text>
                  </View>
                )}
                {r.suggestions?.length > 0 && (
                  <View className="detail-section">
                    <Text className="detail-label">{t("analysis.mitigation")}</Text>
                    {r.suggestions.map((s, j) => (
                      <Text key={j} className="suggestion-item">{j + 1}. {s}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
