import { useState } from "react"
import { View, Text, Button, ScrollView, Input } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import { t } from "@/i18n"
import { useAuthStore } from "@/stores/authStore"
import { useAppStore } from "@/stores/appStore"
import { apiGet, apiPost, apiUpload } from "@/lib/api"
import type { FileItem } from "@/types"
import FloatingExpertButton from "@/components/FloatingExpertButton"
import "./dashboard.scss"

interface DashboardStats {
  file_count: number
  bid_count: number
  points: number
}

export default function DashboardPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const setAuth = useAuthStore((s) => s.setAuth)
  const { currentIndustry, industries } = useAppStore()

  const [files, setFiles] = useState<FileItem[]>([])
  const [stats, setStats] = useState<DashboardStats>({ file_count: 0, bid_count: 0, points: 0 })
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showAgreement, setShowAgreement] = useState(false)
  const [pendingAgreementIds, setPendingAgreementIds] = useState<string[]>([])

  const fetchData = async () => {
    if (!isLoggedIn) return
    try {
      const r = await apiGet<{ success: boolean; data: { items: FileItem[] } }>("/api/files?limit=3")
      setFiles(r.data?.items || [])
    } catch { /* ignore */ }
    try {
      const r = await apiGet<{ success: boolean; data: DashboardStats }>("/api/bid/dashboard-stats")
      if (r.data) setStats(r.data)
    } catch { /* ignore */ }
  }

  useDidShow(() => { fetchData() })

  const sendCode = async () => {
    if (!phone || phone.length < 11) {
      Taro.showToast({ title: "请输入手机号", icon: "none" })
      return
    }
    try {
      await apiPost("/api/account/verify-code/send", { phone })
      Taro.showToast({ title: t("auth.codeSent"), icon: "success" })
    } catch { Taro.showToast({ title: t("auth.sendFailed"), icon: "none" }) }
  }

  const loginByPhone = async () => {
    if (!code) {
      Taro.showToast({ title: "请输入验证码", icon: "none" })
      return
    }
    try {
      const r = await apiPost<{ success: boolean; data: { id: string; member_id: string } }>(
        "/api/account/login/phone", { phone, code },
      )
      if (r.data?.id) {
        setAuth(r.data.id, r.data.member_id, r.data.token)
        fetchData()
      }
    } catch (e: unknown) {
      Taro.showToast({ title: (e as Error).message || t("auth.loginFailed"), icon: "none" })
    }
  }

  const checkAgreements = async (): Promise<boolean> => {
    try {
      const r = await apiGet<{ success: boolean; data: { id: string; signed: boolean }[] }>("/api/agreements/user-status")
      const items = r.data || []
      const pending = items.filter((a) => !a.signed).map((a) => a.id)
      if (pending.length > 0) {
        setPendingAgreementIds(pending)
        setShowAgreement(true)
        return false
      }
      return true
    } catch { return true }
  }

  const signAgreements = async () => {
    try {
      for (const id of pendingAgreementIds) {
        await apiPost("/api/agreements/sign", { agreement_id: id })
      }
      setShowAgreement(false)
      proceedToUpload()
    } catch {
      Taro.showToast({ title: "协议签署失败", icon: "none" })
    }
  }

  const handleUpload = async () => {
    const ok = await checkAgreements()
    if (ok) proceedToUpload()
  }

  const proceedToUpload = () => {
    Taro.chooseMessageFile({
      count: 1,
      type: "file",
      success: async (res) => {
        setUploading(true)
        setUploadProgress(0)
        try {
          const result = await apiUpload(
            res.tempFiles[0].path,
            { agreed_agreement_ids: "agree-svc-001,agree-privacy-001" },
            (p) => setUploadProgress(p),
          )
          Taro.showToast({ title: t("dashboard.uploadSuccess"), icon: "success" })
          fetchData()
          Taro.navigateTo({ url: `/pages/analysis/analysis?fileId=${result.file_id}&animating=true` })
        } catch (e: unknown) {
          Taro.showToast({ title: (e as Error).message || t("dashboard.uploadFailed"), icon: "none" })
        } finally {
          setUploading(false)
        }
      },
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  if (!isLoggedIn) {
    return (
      <View className="page-center auth-page">
        <Text className="auth-title">{t("auth.title")}</Text>
        <Text className="auth-hint">{t("auth.hint")}</Text>
        <Input
          className="auth-input"
          type="number"
          maxlength={11}
          placeholder={t("auth.phonePlaceholder")}
          value={phone}
          onInput={(e) => setPhone(e.detail.value)}
        />
        <View className="code-row">
          <Input
            className="auth-input flex-1"
            type="number"
            maxlength={6}
            placeholder={t("auth.codePlaceholder")}
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
          <Button className="code-btn" onClick={sendCode}>{t("auth.sendCode")}</Button>
        </View>
        <Button className="auth-btn" onClick={loginByPhone}>{t("auth.verifyLogin")}</Button>
      </View>
    )
  }

  return (
    <View className="page">
      <ScrollView scrollY className="scroll-area">
        <View className="industry-bar">
          <Text className="industry-label">{currentIndustry.name}</Text>
          {industries.length > 1 && <Text className="industry-arrow">&#9662;</Text>}
        </View>

        {/* Stats cards */}
        <View className="stats-row">
          <View className="stat-card">
            <Text className="stat-value">{stats.file_count}</Text>
            <Text className="stat-label">Files</Text>
          </View>
          <View className="stat-card">
            <Text className="stat-value">{stats.bid_count}</Text>
            <Text className="stat-label">Bids</Text>
          </View>
          <View className="stat-card">
            <Text className="stat-value">{stats.points}</Text>
            <Text className="stat-label">Points</Text>
          </View>
        </View>

        <View className="advisor-card" onClick={() => Taro.switchTab({ url: "/pages/advisor/advisor" })}>
          <View className="advisor-info">
            <Text className="advisor-title">{t("dashboard.advisorTitle")}</Text>
            <Text className="advisor-reply">{t("dashboard.advisorReply", { count: 3 })}</Text>
          </View>
          <Text className="advisor-arrow">&gt;</Text>
        </View>

        <View className="upload-section">
          <Button className="btn-upload-main" onClick={handleUpload} loading={uploading}>
            {uploading ? t("dashboard.uploading", { percent: uploadProgress }) : t("dashboard.uploadBtn")}
          </Button>
          {uploading && (
            <View className="progress-bar">
              <View className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </View>
          )}
        </View>

        <View className="quick-actions">
          <View className="action-card" onClick={() => {
            if (files.length > 0) Taro.navigateTo({ url: `/pages/analysis/analysis?fileId=${files[0].id}` })
          }}>
            <Text className="action-title">{t("dashboard.quickReview")}</Text>
            <Text className="action-desc">{t("dashboard.quickReviewDesc", { count: 0 })}</Text>
          </View>
          <View className="action-card" onClick={() => {
            if (files.length > 0) Taro.navigateTo({ url: `/pages/bid/bid?fileId=${files[0].id}` })
          }}>
            <Text className="action-title">{t("dashboard.quickBid")}</Text>
            <Text className="action-desc">{t("dashboard.quickBidDesc", { count: 0 })}</Text>
          </View>
          <View className="action-card" onClick={() => Taro.navigateTo({ url: "/pages/tools/tools" })}>
            <Text className="action-title">{t("dashboard.quickTools")}</Text>
            <Text className="action-desc">{t("dashboard.quickToolsDesc")}</Text>
          </View>
          <View className="action-card" onClick={() => Taro.navigateTo({ url: "/pages/ocr/ocr" })}>
            <Text className="action-title">{t("dashboard.quickScan")}</Text>
            <Text className="action-desc">{t("dashboard.quickScanDesc")}</Text>
          </View>
        </View>

        <View className="section-header">
          <Text className="section-title">{t("dashboard.recentProjects")}</Text>
          <Text className="section-more" onClick={() => Taro.switchTab({ url: "/pages/projects/projects" })}>
            {t("dashboard.viewAll")} &gt;
          </Text>
        </View>

        {files.length === 0 ? (
          <View className="empty">
            <Text className="empty-text">{t("dashboard.noFiles")}</Text>
            <Text className="empty-hint">{t("dashboard.emptyHint")}</Text>
          </View>
        ) : (
          <View className="file-list">
            {files.map((f) => (
              <View key={f.id} className="file-card" onClick={() => {
                Taro.navigateTo({ url: `/pages/analysis/analysis?fileId=${f.id}` })
              }}>
                <View className="file-info">
                  <Text className="file-name">{f.filename}</Text>
                  <Text className="file-meta">
                    {f.file_type} {formatSize(f.file_size)} {f.status === "ready" ? t("dashboard.ready") : f.status}
                  </Text>
                  <Text className="file-date">{f.created_at?.slice(0, 10)}</Text>
                </View>
                <Text className="file-arrow">&gt;</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {showAgreement && (
        <View className="agreement-overlay">
          <View className="agreement-modal">
            <Text className="agreement-modal-title">{t("dashboard.agreementTitle")}</Text>
            <Text className="agreement-modal-hint">{t("dashboard.agreePrompt")}</Text>
            <Button className="agreement-modal-btn" onClick={signAgreements}>
              {t("dashboard.agree")}
            </Button>
          </View>
        </View>
      )}

      <FloatingExpertButton />
    </View>
  )
}
