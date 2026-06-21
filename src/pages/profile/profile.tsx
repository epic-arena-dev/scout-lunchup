import { useState } from "react"
import { View, Text, Button, ScrollView } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import { t } from "@/i18n"
import { useAuthStore } from "@/stores/authStore"
import { useAppStore } from "@/stores/appStore"
import { apiGet, apiPost } from "@/lib/api"
import type { UserProfile, PointsAccount, MembershipInfo, OrderItem, PointsTransaction } from "@/types"
import FloatingExpertButton from "@/components/FloatingExpertButton"
import "./profile.scss"

interface ThemeItem {
  id: string
  name: string
  colors: Record<string, string>
  is_active: boolean
}

const BASE_URL = "https://ai.epicarena.cn"

export default function ProfilePage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [points, setPoints] = useState<PointsAccount | null>(null)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [downloads, setDownloads] = useState<PointsTransaction[]>([])
  const [expiryInfo, setExpiryInfo] = useState<{ amount: number; days: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [showOrders, setShowOrders] = useState(false)
  const [showDownloads, setShowDownloads] = useState(false)
  const [showThemes, setShowThemes] = useState(false)
  const [themes, setThemes] = useState<ThemeItem[]>([])
  const [lastSynced, setLastSynced] = useState<string>("")
  const [syncing, setSyncing] = useState(false)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  const fetchAll = async () => {
    if (!isLoggedIn) { setLoading(false); return }
    try {
      const [profileR, pointsR, membershipR] = await Promise.all([
        apiGet<{ success: boolean; data: UserProfile }>("/api/account/profile").catch(() => null),
        apiGet<{ success: boolean; data: PointsAccount }>("/api/points/account").catch(() => null),
        apiGet<{ success: boolean; data: MembershipInfo }>("/api/payment/membership").catch(() => null),
      ])
      if (profileR?.data) setProfile(profileR.data)
      if (pointsR?.data) {
        setPoints(pointsR.data)
        checkExpiry(pointsR.data)
      }
      if (membershipR?.data) setMembership(membershipR.data)
      setLastSynced(new Date().toISOString())
    } catch { /* ignore */ }
    setLoading(false)
  }

  const checkExpiry = async (pts: PointsAccount) => {
    if (pts.balance <= 0) return
    try {
      const r = await apiGet<{ success: boolean; data: { items: PointsTransaction[] } }>(
        "/api/points/transactions?limit=50",
      )
      const items = r.data?.items || []
      const nearExpiry = items
        .filter((tx) => tx.amount > 0 && (tx as any).remaining > 0 && (tx as any).expires_at)
        .sort((a, b) => new Date((a as any).expires_at).getTime() - new Date((b as any).expires_at).getTime())
      if (nearExpiry.length > 0) {
        const tx = nearExpiry[0] as any
        const daysLeft = Math.ceil((new Date(tx.expires_at).getTime() - Date.now()) / 86400000)
        setExpiryInfo({ amount: tx.remaining, days: Math.max(1, daysLeft) })
      }
    } catch { /* ignore */ }
  }

  const fetchOrders = async () => {
    try {
      const r = await apiGet<{ success: boolean; data: { items: OrderItem[] } }>(
        "/api/payment/orders?limit=20",
      )
      setOrders(r.data?.items || [])
    } catch { /* ignore */ }
  }

  const fetchDownloads = async () => {
    try {
      const r = await apiGet<{ success: boolean; data: { items: PointsTransaction[] } }>(
        "/api/points/transactions?limit=20",
      )
      setDownloads((r.data?.items || []).filter((tx) => tx.amount < 0))
    } catch { /* ignore */ }
  }

  useDidShow(() => { fetchAll() })

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      const r = await apiPost<{ success: boolean; data: { amount: number; streak: number; balance: number } }>(
        "/api/points/check-in",
      )
      if (r.data) {
        Taro.showToast({ title: t("profile.checkInSuccess", { amount: r.data.amount }), icon: "success" })
        fetchAll()
      }
    } catch { Taro.showToast({ title: t("profile.checkInFailed"), icon: "none" }) }
    setCheckingIn(false)
  }

  const handleShowOrders = async () => {
    await fetchOrders()
    setShowOrders(true)
  }

  const handleShowDownloads = async () => {
    await fetchDownloads()
    setShowDownloads(true)
  }

  const handleShowThemes = async () => {
    try {
      const res = await Taro.request({
        url: `${BASE_URL}/api/themes`,
      })
      const json = res.data as { success: boolean; data: ThemeItem[] }
      if (json.success) setThemes(json.data || [])
    } catch { /* ignore */ }
    setShowThemes(true)
  }

  const activateTheme = async (id: string) => {
    try {
      const res = await apiPost<{ success: boolean; data: ThemeItem; message: string }>(
        `/api/themes/${id}/activate`, {}
      ) as unknown as { success: boolean; data: ThemeItem; message: string }
      if (res.success && res.data) {
        setTheme(res.data)
        Taro.setNavigationBarColor({ frontColor: "#ffffff", backgroundColor: res.data.colors.primary || "#165DFF" })
        Taro.setTabBarStyle({
          color: res.data.colors.warmMuted || "#6B5E53",
          selectedColor: res.data.colors.primary || "#165DFF",
          backgroundColor: "#ffffff",
          borderStyle: "white",
        })
        Taro.showToast({ title: "已切换", icon: "success" })
        setShowThemes(false)
      }
    } catch { Taro.showToast({ title: "切换失败", icon: "none" }) }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetchAll()
      Taro.showToast({ title: "Settings synced", icon: "success" })
    } catch {
      Taro.showToast({ title: "Sync failed", icon: "none" })
    }
    setSyncing(false)
  }

  const formatSyncedTime = (iso: string): string => {
    if (!iso) return "Never"
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return iso.slice(0, 10)
  }

  const formatYuan = (fen: number) => {
    const yuan = fen / 100
    return yuan % 1 === 0 ? `¥${yuan}` : `¥${yuan.toFixed(2)}`
  }

  const planLabel = (pt: string | null) => {
    if (pt === "monthly") return t("profile.monthlyMember")
    if (pt === "yearly") return t("profile.yearlyMember")
    return t("profile.freeMember")
  }

  const orderTypeLabel = (ot: string) => {
    const map: Record<string, string> = {
      single_download: t("profile.orderType.single_download"),
      monthly: t("profile.orderType.monthly"),
      yearly: t("profile.orderType.yearly"),
    }
    return map[ot] || ot
  }

  const orderStatusLabel = (st: string) => {
    const map: Record<string, string> = {
      pending: t("profile.orderStatus.pending"),
      paid: t("profile.orderStatus.paid"),
      cancelled: t("profile.orderStatus.cancelled"),
    }
    return map[st] || st
  }

  if (loading) {
    return <View className="page-center"><Text style={{ color: "#86909C" }}>{t("common.loading")}</Text></View>
  }

  return (
    <View className="page">
      <ScrollView scrollY className="profile-scroll">
        <View className="profile-header">
          <View className="avatar">
            {profile?.avatar ? (
              <View className="avatar-img" style={{ backgroundImage: `url(${profile.avatar})` }} />
            ) : (
              <View className="avatar-placeholder">
                <Text className="avatar-text">{(profile?.nickname || "U")[0].toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View className="profile-info">
            <Text className="profile-name">{profile?.nickname || t("profile.title")}</Text>
            <Text className="profile-mid">{t("profile.memberId")}: {profile?.member_id || "-"}</Text>
          </View>
          <View className="sync-indicator" onClick={handleSync}>
            <Text className={`sync-dot ${lastSynced ? "synced" : ""}`}>●</Text>
            <Text className="sync-text">
              {syncing ? "Syncing..." : `Synced ${formatSyncedTime(lastSynced)}`}
            </Text>
          </View>
        </View>

        <View className="points-card">
          <View className="points-balance-row">
            <Text className="points-number">
              {points ? `${points.yi} ${t("profile.yiUnit")} ${points.star} ${t("profile.starUnit")}` : "0"}
            </Text>
          </View>
          <Text className="points-total">{t("profile.totalEarned")}: {points?.total_earned || 0}</Text>
          {expiryInfo && (
            <Text className="points-expiry">{expiryInfo.amount}{t("profile.starUnit")}{t("profile.memberExpires", { days: expiryInfo.days })}</Text>
          )}
          <Button className="checkin-btn" onClick={handleCheckIn} loading={checkingIn} disabled={checkingIn}>
            {t("profile.checkIn")}
          </Button>
        </View>

        <View className="member-card">
          <View className="member-info">
            <Text className="member-level">
              {planLabel(membership?.plan_type || null)}
            </Text>
            {membership?.is_member && (
              <Text className="member-expires">{t("profile.memberExpires", { days: membership.days_left })}</Text>
            )}
          </View>
          <Button className="upgrade-btn" onClick={() => Taro.navigateTo({ url: "/pages/subscription/subscription" })}>
            {t("profile.upgradeCTA")}
          </Button>
        </View>

        <View className="menu-list">
          <View className="menu-item" onClick={() => Taro.navigateTo({ url: "/pages/subscription/subscription" })}>
            <Text className="menu-label">{t("profile.buyPlan")}</Text>
            <Text className="menu-arrow">&gt;</Text>
          </View>
          <View className="menu-item" onClick={handleShowOrders}>
            <Text className="menu-label">{t("profile.orderRecords")}</Text>
            <Text className="menu-arrow">&gt;</Text>
          </View>
          <View className="menu-item" onClick={handleShowDownloads}>
            <Text className="menu-label">{t("profile.downloadRecords")}</Text>
            <Text className="menu-arrow">&gt;</Text>
          </View>
          <View className="menu-item" onClick={handleShowThemes}>
            <Text className="menu-label">{t("profile.themeSwitch")}</Text>
            <Text className="menu-value">{theme?.name || t("profile.defaultTheme")}</Text>
            <Text className="menu-arrow">&gt;</Text>
          </View>
          <View className="menu-item" onClick={() => Taro.navigateTo({ url: "/pages/subscription/subscription" })}>
            <Text className="menu-label">Notification Preferences</Text>
            <Text className="menu-arrow">&gt;</Text>
          </View>
          <View className="menu-item" onClick={handleSync}>
            <Text className="menu-label">Sync Settings</Text>
            <Text className="menu-value">{syncing ? "..." : formatSyncedTime(lastSynced)}</Text>
            <Text className="menu-arrow">&gt;</Text>
          </View>
        </View>
      </ScrollView>

      {showOrders && (
        <View className="overlay" onClick={() => setShowOrders(false)}>
          <View className="bottom-panel" onClick={(e) => e.stopPropagation()}>
            <Text className="panel-title">{t("profile.orderRecords")}</Text>
            <ScrollView scrollY className="panel-list">
              {orders.length === 0 ? (
                <Text className="panel-empty">{t("profile.noOrders")}</Text>
              ) : (
                orders.map((o) => (
                  <View key={o.id} className="panel-item">
                    <View className="panel-item-info">
                      <Text className="panel-item-title">{orderTypeLabel(o.order_type)}</Text>
                      <Text className="panel-item-meta">
                        {orderStatusLabel(o.status)} | {o.created_at?.slice(0, 10)}
                      </Text>
                    </View>
                    <Text className="panel-item-amount">{formatYuan(o.amount)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {showDownloads && (
        <View className="overlay" onClick={() => setShowDownloads(false)}>
          <View className="bottom-panel" onClick={(e) => e.stopPropagation()}>
            <Text className="panel-title">{t("profile.downloadRecords")}</Text>
            <ScrollView scrollY className="panel-list">
              {downloads.length === 0 ? (
                <Text className="panel-empty">{t("profile.noDownloads")}</Text>
              ) : (
                downloads.map((d) => (
                  <View key={d.id} className="panel-item">
                    <View className="panel-item-info">
                      <Text className="panel-item-title">{d.description || d.change_type}</Text>
                      <Text className="panel-item-meta">{d.created_at?.slice(0, 10)}</Text>
                    </View>
                    <Text className="panel-item-amount">{d.amount}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {showThemes && (
        <View className="overlay" onClick={() => setShowThemes(false)}>
          <View className="bottom-panel" onClick={(e) => e.stopPropagation()}>
            <Text className="panel-title">{t("profile.themeSwitch")}</Text>
            <ScrollView scrollY className="panel-list">
              {themes.length === 0 ? (
                <Text className="panel-empty">{t("profile.noThemes")}</Text>
              ) : (
                themes.map((item) => (
                  <View key={item.id} className="panel-item">
                    <View className="panel-item-info">
                      <Text className="panel-item-title">{item.name}</Text>
                      {item.is_active && <Text className="panel-item-meta">{t("profile.activeTheme")}</Text>}
                    </View>
                    {!item.is_active && (
                      <Button className="theme-activate-btn" onClick={() => activateTheme(item.id)}>
                        {t("profile.activate")}
                      </Button>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      <FloatingExpertButton />
    </View>
  )
}
