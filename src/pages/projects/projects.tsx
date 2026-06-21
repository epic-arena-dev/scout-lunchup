import { useState, useCallback } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import Taro, { useDidShow, usePullDownRefresh } from "@tarojs/taro"
import { t } from "@/i18n"
import { apiGet } from "@/lib/api"
import type { FileItem } from "@/types"
import FloatingExpertButton from "@/components/FloatingExpertButton"
import "./projects.scss"

type TabKey = "all" | "files" | "bids"

interface BidTaskItem {
  id: string
  file_id: string
  template_id: string
  status: "processing" | "completed" | "failed"
  created_at: string
  filename?: string
  template_name?: string
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  uploaded: { label: "Uploaded", cls: "status-analyzing" },
  analyzing: { label: "Analyzing", cls: "status-analyzing" },
  parsed: { label: "Ready", cls: "status-reviewable" },
  reviewed: { label: "Ready", cls: "status-reviewable" },
  generating: { label: "Generating", cls: "status-generating" },
  generated: { label: "Completed", cls: "status-completed" },
  ready: { label: "Ready", cls: "status-reviewable" },
  failed: { label: "Failed", cls: "status-failed" },
  blocked: { label: "Blocked", cls: "status-failed" },
}

const BID_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  processing: { label: "Processing", cls: "status-generating" },
  completed: { label: "Completed", cls: "status-completed" },
  failed: { label: "Failed", cls: "status-failed" },
}

export default function ProjectsPage() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [bids, setBids] = useState<BidTaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("all")

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [filesR, bidsR] = await Promise.all([
        apiGet<{ success: boolean; data: { items: FileItem[] } }>("/api/files?limit=100").catch(() => null),
        apiGet<{ success: boolean; data: { items: BidTaskItem[] } }>("/api/bid/tasks?limit=100").catch(() => null),
      ])
      if (filesR?.data?.items) setFiles(filesR.data.items)
      if (bidsR?.data?.items) setBids(bidsR.data.items)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useDidShow(() => { fetchAll() })
  usePullDownRefresh(() => { fetchAll().then(() => Taro.stopPullDownRefresh()) })

  const formatSize = (bytes: number) => {
    if (!bytes) return ""
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  const formatDate = (iso: string) => iso?.slice(0, 10) || ""

  // Build unified list based on active tab
  const allItems = [
    ...files.map((f) => ({
      type: "file" as const,
      id: f.id,
      title: f.filename,
      subtitle: `${f.file_type} · ${formatSize(f.file_size)}`,
      date: f.created_at,
      status: f.status,
      statusLabel: STATUS_MAP[f.status]?.label || f.status,
      statusCls: STATUS_MAP[f.status]?.cls || "",
      data: f,
    })),
    ...bids.map((b) => ({
      type: "bid" as const,
      id: b.id,
      title: b.filename || `Bid ${b.id.slice(0, 8)}`,
      subtitle: b.template_name || b.template_id || "Standard",
      date: b.created_at,
      status: b.status,
      statusLabel: BID_STATUS_MAP[b.status]?.label || b.status,
      statusCls: BID_STATUS_MAP[b.status]?.cls || "",
      data: b,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const filteredItems = activeTab === "all"
    ? allItems
    : activeTab === "files"
      ? allItems.filter((item) => item.type === "file")
      : allItems.filter((item) => item.type === "bid")

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "files", label: "Files" },
    { key: "bids", label: "Bids" },
  ]

  const handleItemClick = (item: typeof allItems[0]) => {
    if (item.type === "file") {
      const f = item.data as FileItem
      if (f.status === "generated" || f.status === "ready") {
        // Check if there's a linked bid task
        const linkedBid = bids.find((b) => b.file_id === f.id && b.status === "completed")
        if (linkedBid) {
          Taro.navigateTo({ url: `/pages/preview/preview?taskId=${linkedBid.id}&fileId=${f.id}` })
        } else {
          Taro.navigateTo({ url: `/pages/analysis/analysis?fileId=${f.id}` })
        }
      } else {
        Taro.navigateTo({ url: `/pages/analysis/analysis?fileId=${f.id}` })
      }
    } else {
      const b = item.data as BidTaskItem
      Taro.navigateTo({ url: `/pages/preview/preview?taskId=${b.id}&fileId=${b.file_id}` })
    }
  }

  const handleQuickAnalyze = (e: any, fileId: string) => {
    e.stopPropagation()
    Taro.navigateTo({ url: `/pages/analysis/analysis?fileId=${fileId}` })
  }

  const handleQuickBid = (e: any, fileId: string) => {
    e.stopPropagation()
    Taro.navigateTo({ url: `/pages/bid/bid?fileId=${fileId}` })
  }

  const handleQuickDownload = (e: any, fileId: string) => {
    e.stopPropagation()
    Taro.navigateTo({ url: `/pages/preview/preview?fileId=${fileId}` })
  }

  return (
    <View className="page">
      {/* Tab bar */}
      <View className="tab-bar">
        {tabs.map((tab) => (
          <View
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text className={`tab-text ${activeTab === tab.key ? "active" : ""}`}>
              {tab.label}
            </Text>
            {activeTab === tab.key && <View className="tab-indicator" />}
          </View>
        ))}
      </View>

      <ScrollView scrollY className="scroll-area projects-scroll">
        {loading ? (
          <View className="page-center">
            <Text style={{ color: "#86909C" }}>{t("common.loading")}</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View className="projects-empty">
            <Text className="empty-icon">📄</Text>
            <Text className="empty-text">
              {activeTab === "bids" ? "No bid tasks yet" : "No projects yet"}
            </Text>
            <Text className="empty-hint">
              {activeTab === "bids"
                ? "Generate bids from analyzed files"
                : "Upload tender documents to start"}
            </Text>
          </View>
        ) : (
          <View className="project-list">
            {filteredItems.map((item) => (
              <View
                key={`${item.type}-${item.id}`}
                className="project-card"
                onClick={() => handleItemClick(item)}
              >
                {/* Header: title + status badge */}
                <View className="project-header">
                  <View className="project-title-row">
                    {item.type === "bid" && (
                      <Text className="item-type-tag">Bid</Text>
                    )}
                    <Text className="project-name">{item.title}</Text>
                  </View>
                  <Text className={`project-status ${item.statusCls}`}>
                    {item.statusLabel}
                  </Text>
                </View>

                {/* Meta: type/size + date */}
                <View className="project-meta">
                  <Text className="project-info">{item.subtitle}</Text>
                  <Text className="project-date">{formatDate(item.date)}</Text>
                </View>

                {/* Quick actions */}
                <View className="project-actions">
                  {item.type === "file" && (
                    <>
                      <View
                        className="action-chip"
                        onClick={(e) => handleQuickAnalyze(e, item.id)}
                      >
                        <Text className="action-chip-text">Analyze</Text>
                      </View>
                      {item.status !== "blocked" && (
                        <View
                          className="action-chip primary"
                          onClick={(e) => handleQuickBid(e, item.id)}
                        >
                          <Text className="action-chip-text primary">Generate Bid</Text>
                        </View>
                      )}
                    </>
                  )}
                  {item.type === "bid" && item.status === "completed" && (
                    <>
                      <View
                        className="action-chip"
                        onClick={(e) => handleQuickDownload(e, (item.data as BidTaskItem).file_id)}
                      >
                        <Text className="action-chip-text">Download</Text>
                      </View>
                      <View
                        className="action-chip"
                        onClick={(e) => {
                          e.stopPropagation()
                          Taro.navigateTo({ url: `/pages/analysis/analysis?fileId=${(item.data as BidTaskItem).file_id}` })
                        }}
                      >
                        <Text className="action-chip-text">Re-analyze</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <FloatingExpertButton />
    </View>
  )
}
