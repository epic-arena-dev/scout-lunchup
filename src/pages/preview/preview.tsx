import { useState, useRef, useEffect } from "react"
import { View, Text, Button, ScrollView } from "@tarojs/components"
import Taro, { useLoad, useDidHide, useShareAppMessage } from "@tarojs/taro"
import { t } from "@/i18n"
import { apiGet } from "@/lib/api"
import type { BidSection, ViewRecord } from "@/types"
import "./preview.scss"

interface BidTaskResult {
  task_id: string; status: string; template: string
  tech_bid: { sections: BidSection[] }
  comm_bid: { sections: BidSection[] }
  missing_items: string[]; created_at: string
}

const HISTORY_KEY = "preview_view_history"
const POLL_INTERVAL = 2000
const POLL_MAX = 30

export default function PreviewPage() {
  const [task, setTask] = useState<{ result: BidTaskResult; file_id?: string } | null>(null)
  const [fileId, setFileId] = useState("")
  const [taskId, setTaskId] = useState("")
  const [tab, setTab] = useState<"technical" | "commercial">("technical")
  const [loading, setLoading] = useState(true)
  const [pollStatus, setPollStatus] = useState("")
  const [fontSize, setFontSize] = useState(28)
  const [showChapters, setShowChapters] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const [showDesktopView, setShowDesktopView] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [signedUrl, setSignedUrl] = useState("")
  const [urlLoading, setUrlLoading] = useState(false)
  const [viewHistory, setViewHistory] = useState<ViewRecord[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const cancelled = useRef(false)

  useDidHide(() => { cancelled.current = true })
  useEffect(() => () => { cancelled.current = true }, [])

  // WeChat share config
  useShareAppMessage(() => ({
    title: task?.result
      ? `Bid Preview — ${task.result.template}`
      : "EpicArena Bid",
    path: `/pages/preview/preview?taskId=${taskId}&fileId=${fileId}`,
  }))

  useLoad(({ taskId: tid, fileId: fid }: { taskId?: string; fileId?: string } = {}) => {
    if (tid) setTaskId(tid)
    if (fid) setFileId(fid)
    if (tid) {
      pollTask(tid)
    } else if (fid) {
      setLoading(false)
    }
  })

  useEffect(() => {
    try {
      const stored = Taro.getStorageSync(HISTORY_KEY)
      if (stored) setViewHistory(JSON.parse(stored))
    } catch { console.warn("preview: corrupted history") }
  }, [])

  const pollTask = async (tid: string) => {
    setPollStatus("Polling...")
    for (let i = 0; i < POLL_MAX; i++) {
      if (cancelled.current) return
      try {
        const r = await apiGet<{ success: boolean; data: { file_id?: string; status: string; result: BidTaskResult } }>(
          `/api/bid/status/${tid}`,
        )
        if (r.data?.file_id) setFileId(r.data.file_id)
        const status = r.data?.status || r.data?.result?.status
        setPollStatus(status || "")

        if (status === "completed" && r.data?.result) {
          setTask({ result: r.data.result, file_id: r.data.file_id })
          setLoading(false)
          return
        }
        if (status === "failed") {
          setLoading(false)
          Taro.showToast({ title: "Bid generation failed", icon: "none" })
          return
        }
      } catch { console.warn("preview: poll retry") }
      if (cancelled.current) return
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
    }
    setLoading(false)
    Taro.showToast({ title: t("preview.timeout"), icon: "none" })
  }

  const generateSignedUrl = async () => {
    if (!fileId) {
      Taro.showToast({ title: "File not found", icon: "none" })
      return
    }
    setUrlLoading(true)
    try {
      const r = await apiGet<{ success: boolean; url: string }>(`/api/files/${fileId}/download`)
      const url = r.url
      setSignedUrl(url)
      const record: ViewRecord = {
        url,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      }
      const updated = [record, ...viewHistory].slice(0, 20)
      setViewHistory(updated)
      Taro.setStorageSync(HISTORY_KEY, JSON.stringify(updated))
    } catch {
      Taro.showToast({ title: t("preview.linkFailed"), icon: "none" })
    } finally {
      setUrlLoading(false)
    }
  }

  const handleReAnalyze = async () => {
    if (!fileId) return
    setActionLoading("reanalyze")
    Taro.navigateTo({ url: `/pages/analysis/analysis?fileId=${fileId}` })
    setActionLoading(null)
  }

  const handleShare = async () => {
    setActionLoading("share")
    // Taro.showShareMenu is called implicitly by useShareAppMessage
    // Fallback: copy the current page path
    try {
      const sharePath = `/pages/preview/preview?taskId=${taskId}&fileId=${fileId}`
      await Taro.setClipboardData({ data: sharePath })
      Taro.showToast({ title: "Share link copied", icon: "success" })
    } catch {
      Taro.showToast({ title: "Share failed", icon: "none" })
    }
    setActionLoading(null)
  }

  const handleDownload = async () => {
    setActionLoading("download")
    setShowDesktopView(true)
    if (!signedUrl) await generateSignedUrl()
    setActionLoading(null)
  }

  const openDesktopView = async () => {
    setShowDesktopView(true)
    if (!signedUrl) await generateSignedUrl()
  }

  const copyLink = () => {
    if (signedUrl) {
      Taro.setClipboardData({ data: signedUrl })
      Taro.showToast({ title: t("preview.linkCopied"), icon: "success" })
    }
  }

  const regenerateLink = async () => {
    setSignedUrl("")
    await generateSignedUrl()
  }

  const isExpired = (expiresAt: string) => new Date(expiresAt) <= new Date()

  // Polling loading state
  if (loading && pollStatus) {
    return (
      <View className="page-center polling-view">
        <View className="polling-spinner" />
        <Text className="polling-status">{pollStatus}</Text>
        <Text className="polling-hint">AI is drafting your bid document...</Text>
        {taskId && (
          <Text className="polling-task-id">Task: {taskId.slice(0, 8)}</Text>
        )}
      </View>
    )
  }

  if (loading) return <View className="page-center"><Text>{t("preview.loading")}</Text></View>

  const sections = tab === "technical"
    ? task?.result.tech_bid?.sections || []
    : task?.result.comm_bid?.sections || []

  return (
    <View className="page">
      {task && (
        <>
          {/* Status banner */}
          {pollStatus && pollStatus !== "completed" && (
            <View className="status-banner">
              <Text className="status-banner-text">Status: {pollStatus}</Text>
            </View>
          )}

          <View className="top-bar">
            <Button className="chapter-toggle" onClick={() => setShowChapters(!showChapters)}>
              {t("preview.chapters")}
            </Button>
            <View className="font-controls">
              <Button className="font-btn" onClick={() => setFontSize(Math.max(22, fontSize - 2))}>A-</Button>
              <Text className="font-size-label">{fontSize}</Text>
              <Button className="font-btn" onClick={() => setFontSize(Math.min(36, fontSize + 2))}>A+</Button>
            </View>
          </View>

          {showChapters && (
            <ScrollView scrollY className="chapter-panel">
              {sections.map((s, i) => (
                <View
                  key={i}
                  className={`chapter-item ${activeSection === i ? "active" : ""}`}
                  onClick={() => { setActiveSection(i); setShowChapters(false) }}
                >
                  <Text>{s.title}</Text>
                  {s.status === "missing" && <Text className="chapter-missing">!</Text>}
                </View>
              ))}
            </ScrollView>
          )}

          <View className="top-bar">
            <View className="tabs">
              <Button
                className={`tab ${tab === "technical" ? "active" : ""}`}
                onClick={() => { setTab("technical"); setActiveSection(0) }}
              >{t("preview.technical")}</Button>
              <Button
                className={`tab ${tab === "commercial" ? "active" : ""}`}
                onClick={() => { setTab("commercial"); setActiveSection(0) }}
              >{t("preview.commercial")}</Button>
            </View>
          </View>

          {task.result.missing_items?.length > 0 && (
            <View className="missing-alert">
              <Text className="missing-title">{t("preview.missingAlert")}: {task.result.missing_items.join(", ")}</Text>
              <Text className="missing-hint">{t("preview.missingHint")}</Text>
            </View>
          )}

          <ScrollView scrollY className="content" scrollTop={activeSection * 200}>
            {sections.map((s, i) => (
              <View key={i} className="section-card">
                <View className="section-header">
                  <Text className="section-title">{s.title}</Text>
                  {s.status === "missing" && <Text className="tag-missing">{t("preview.pending")}</Text>}
                </View>
                {s.status === "missing" ? (
                  <View className="missing-placeholder">
                    <Text>[{t("preview.pending")}: {s.content}]</Text>
                  </View>
                ) : (
                  <Text className="section-content" style={{ fontSize: `${fontSize}px` }}>{s.content}</Text>
                )}
              </View>
            ))}
          </ScrollView>

          {/* ─── Quick Actions Bar ─── */}
          <View className="quick-actions-bar">
            <Button
              className="action-btn"
              onClick={handleReAnalyze}
              loading={actionLoading === "reanalyze"}
            >
              🔍 Re-analyze
            </Button>
            <Button
              className="action-btn"
              onClick={handleDownload}
              loading={actionLoading === "download"}
            >
              ⬇ Download
            </Button>
            <Button
              className="action-btn share-btn"
              openType="share"
              onClick={handleShare}
            >
              📤 Share
            </Button>
          </View>
        </>
      )}

      {!task && fileId && (
        <View className="page-center">
          <Text style={{ color: "#86909C" }}>{t("preview.loading")}</Text>
        </View>
      )}

      {!task && !fileId && (
        <View className="page-center">
          <Text style={{ color: "#86909C" }}>No bid data available</Text>
        </View>
      )}

      {/* Desktop view modal */}
      {showDesktopView && (
        <View className="overlay" onClick={() => setShowDesktopView(false)}>
          <View className="desktop-view-modal" onClick={(e) => e.stopPropagation()}>
            <Text className="modal-title">{t("preview.scanQR")}</Text>
            {urlLoading ? (
              <Text className="url-loading">{t("common.loading")}</Text>
            ) : signedUrl ? (
              <>
                <View className="url-display">
                  <Text className="url-text" numberOfLines={3}>{signedUrl}</Text>
                </View>
                <View className="modal-actions">
                  <Button className="copy-btn" onClick={copyLink}>{t("preview.copyLink")}</Button>
                  <Button className="regen-btn" onClick={regenerateLink}>{t("preview.regenerate")}</Button>
                </View>
                <Text className="expires-hint">{t("preview.linkExpiresIn", { hours: 1 })}</Text>
              </>
            ) : (
              <Text style={{ color: "#86909C" }}>Link generation failed</Text>
            )}
          </View>
        </View>
      )}

      {/* History panel */}
      {showHistory && (
        <View className="overlay" onClick={() => setShowHistory(false)}>
          <View className="history-panel" onClick={(e) => e.stopPropagation()}>
            <Text className="modal-title">{t("preview.viewHistory")}</Text>
            <ScrollView scrollY className="history-list">
              {viewHistory.length === 0 ? (
                <Text className="history-empty">{t("preview.noHistory")}</Text>
              ) : (
                viewHistory.map((rec, i) => (
                  <View key={i} className="history-item">
                    <View className="history-info">
                      <Text className="history-time">
                        {rec.generatedAt.slice(0, 16).replace("T", " ")}
                      </Text>
                      <Text className={isExpired(rec.expiresAt) ? "history-expired" : "history-active"}>
                        {isExpired(rec.expiresAt) ? "Expired" : "Active"}
                      </Text>
                    </View>
                    <Button
                      className="history-regen"
                      onClick={() => {
                        setSignedUrl("")
                        setShowHistory(false)
                        setShowDesktopView(true)
                        generateSignedUrl()
                      }}
                    >{t("preview.regenerate")}</Button>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      <View className="bottom-actions">
        <Button className="btn-desktop-view" onClick={openDesktopView}>
          {t("preview.viewOnComputer")}
        </Button>
        <Button className="btn-history" onClick={() => setShowHistory(!showHistory)}>
          {t("preview.viewHistory")}
        </Button>
      </View>
    </View>
  )
}
