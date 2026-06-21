import { useState, useEffect, useCallback } from "react"
import { View, Text, Button, ScrollView, Switch } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { t } from "@/i18n"
import { apiGet } from "@/lib/api"
import type { PlanInfo } from "@/types"
import {
  getStoredSettings,
  enableAllAlerts,
  openSubscribeSettings,
  toggleSingleAlert,
  type SubscribeSettings,
} from "@/services/subscribe"
import FloatingExpertButton from "@/components/FloatingExpertButton"
import "./subscription.scss"

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<Record<string, PlanInfo>>({})
  const [loading, setLoading] = useState(true)
  const [showConfirm, setShowConfirm] = useState<string | null>(null)

  // ---- Bid Alert state ----
  const [alertSettings, setAlertSettings] = useState<SubscribeSettings>(getStoredSettings)
  const [alertLoading, setAlertLoading] = useState(false)
  const [toggleLoading, setToggleLoading] = useState<keyof SubscribeSettings | null>(null)

  useEffect(() => {
    fetchPlans()
  }, [])

  // Sync alert settings from storage on mount (in case backend sync updated them)
  useEffect(() => {
    setAlertSettings(getStoredSettings())
  }, [])

  const fetchPlans = async () => {
    try {
      const r = await apiGet<{ success: boolean; data: Record<string, PlanInfo> }>(
        "/api/payment/plans",
      )
      if (r.data) setPlans(r.data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  // ---- Bid Alert handlers ----

  const handleEnableAlerts = useCallback(async () => {
    setAlertLoading(true)
    try {
      const result = await enableAllAlerts()
      // Refresh local state
      setAlertSettings(getStoredSettings())

      const enabledCount = result.accepted.length
      if (enabledCount > 0) {
        Taro.showToast({
          title: t("subscription.subscribeSuccess"),
          icon: "success",
        })
      } else if (result.rejected.length > 0) {
        Taro.showToast({
          title: t("subscription.subscribeFailed"),
          icon: "none",
          duration: 2500,
        })
      }
    } catch {
      Taro.showToast({
        title: t("subscription.subscribeFailed"),
        icon: "none",
      })
    } finally {
      setAlertLoading(false)
    }
  }, [])

  const handleManageSettings = useCallback(async () => {
    await openSubscribeSettings()
    // Refresh state after returning from settings
    setTimeout(() => {
      setAlertSettings(getStoredSettings())
    }, 500)
  }, [])

  // ---- Individual alert toggle ----

  const handleToggle = useCallback(async (key: keyof SubscribeSettings, enable: boolean) => {
    setToggleLoading(key)
    try {
      const result = await toggleSingleAlert(key, enable)
      if (result === null && enable) {
        // User rejected WeChat dialog — guide to system settings
        Taro.showModal({
          title: t("subscription.needPermissionTitle"),
          content: t("subscription.needPermissionMsg"),
          confirmText: t("subscription.goSettings"),
          cancelText: t("common.cancel"),
          success: (modalRes) => {
            if (modalRes.confirm) openSubscribeSettings()
          },
        })
      }
      // Refresh local state
      setAlertSettings(getStoredSettings())
    } catch {
      Taro.showToast({ title: t("subscription.toggleFailed"), icon: "none" })
    } finally {
      setToggleLoading(null)
    }
  }, [])

  // Count enabled alerts
  const enabledCount = [
    alertSettings.bidMatch,
    alertSettings.deadlineReminder,
    alertSettings.resultNotice,
    alertSettings.systemNotice,
  ].filter(Boolean).length

  const allEnabled = enabledCount === 4

  // ---- Payment handlers ----

  const handleBuy = (planType: string) => {
    if (planType === "single_download") {
      Taro.showToast({ title: t("subscription.needUploadFirst"), icon: "none" })
      return
    }
    setShowConfirm(planType)
  }

  const confirmPay = (planType: string) => {
    setShowConfirm(null)
    // Navigate to dedicated payment page for WeChat JSAPI payment
    Taro.navigateTo({ url: `/pages/payment/payment?planType=${planType}` })
  }

  const formatYuan = (fen: number) => {
    const yuan = fen / 100
    return yuan % 1 === 0 ? `¥${yuan}` : `¥${yuan.toFixed(2)}`
  }

  const planOrder = ["single_download", "monthly", "yearly"]
  const planInfoMap: Record<string, { name: string; desc: string; isRecommended: boolean }> = {
    single_download: { name: t("subscription.singleDownload"), desc: t("subscription.singleDesc"), isRecommended: false },
    monthly: { name: t("subscription.monthlyPlan"), desc: t("subscription.unlimitedDownload"), isRecommended: true },
    yearly: { name: t("subscription.yearlyPlan"), desc: t("subscription.unlimitedDownload"), isRecommended: false },
  }

  // Alert items for rendering
  const alertItems = [
    {
      key: "bidMatch" as const,
      icon: "🔔",
      title: t("subscription.bidMatchAlert"),
      desc: t("subscription.bidMatchAlertDesc"),
    },
    {
      key: "deadlineReminder" as const,
      icon: "⏰",
      title: t("subscription.deadlineAlert"),
      desc: t("subscription.deadlineAlertDesc"),
    },
    {
      key: "resultNotice" as const,
      icon: "📋",
      title: t("subscription.resultAlert"),
      desc: t("subscription.resultAlertDesc"),
    },
    {
      key: "systemNotice" as const,
      icon: "📢",
      title: t("subscription.systemAlert"),
      desc: t("subscription.systemAlertDesc"),
    },
  ]

  if (loading) {
    return <View className="page-center"><Text style={{ color: "#86909C" }}>{t("common.loading")}</Text></View>
  }

  return (
    <View className="page">
      <ScrollView scrollY className="sub-scroll">
        {/* ===== Bid Alert Section ===== */}
        <View className="alert-section">
          <View className="alert-section-header">
            <Text className="alert-section-title">{t("subscription.alertTitle")}</Text>
            <Text className="alert-section-desc">{t("subscription.alertDesc")}</Text>
          </View>

          {/* Alert items */}
          <View className="alert-list">
            {alertItems.map((item) => {
              const isEnabled = alertSettings[item.key]
              const isToggling = toggleLoading === item.key
              return (
                <View key={item.key} className={`alert-item ${isEnabled ? "alert-item-on" : ""}`}>
                  <View className="alert-item-left">
                    <Text className="alert-item-icon">{item.icon}</Text>
                    <View className="alert-item-text">
                      <Text className="alert-item-title">{item.title}</Text>
                      <Text className="alert-item-desc">{item.desc}</Text>
                    </View>
                  </View>
                  <View className="alert-item-right">
                    {isToggling ? (
                      <View className="alert-toggle-loading">
                        <Text className="alert-toggle-loading-text">{t("common.loading")}</Text>
                      </View>
                    ) : (
                      <Switch
                        checked={isEnabled}
                        color="#165DFF"
                        onChange={(e) => handleToggle(item.key, e.detail.value)}
                      />
                    )}
                  </View>
                </View>
              )
            })}
          </View>

          {/* Action area */}
          <View className="alert-actions">
            {!allEnabled && (
              <Button
                className="alert-enable-btn"
                onClick={handleEnableAlerts}
                loading={alertLoading}
              >
                {t("subscription.enableAlerts")}
              </Button>
            )}
            {allEnabled && (
              <View className="alert-all-on">
                <Text className="alert-all-on-text">{t("subscription.allEnabled")}</Text>
              </View>
            )}
            <Button
              className="alert-settings-btn"
              onClick={handleManageSettings}
            >
              {t("subscription.manageSettings")}
            </Button>
          </View>
        </View>

        {/* ===== Plan Cards ===== */}
        <View className="plan-cards">
          {planOrder.map((type) => {
            const plan = plans[type]
            if (!plan) return null
            const info = planInfoMap[type]
            const isRecommended = info.isRecommended
            const yuan = plan.amount / 100
            const priceText = yuan % 1 === 0 ? `¥${yuan}` : `¥${yuan.toFixed(2)}`

            return (
              <View key={type} className={`plan-card ${isRecommended ? "plan-recommended" : ""}`}>
                {isRecommended && (
                  <View className="recommend-tag">
                    <Text className="recommend-text">{t("subscription.recommend")}</Text>
                  </View>
                )}
                <Text className="plan-name">{info.name}</Text>
                <View className="plan-price-row">
                  <Text className="plan-price">{priceText}</Text>
                  {type === "monthly" && <Text className="plan-unit">{t("subscription.perMonth")}</Text>}
                  {type === "yearly" && <Text className="plan-unit">{t("subscription.perYear")}</Text>}
                </View>
                <Text className="plan-desc">{info.desc}</Text>
                {type === "yearly" && plans.monthly && (
                  <Text className="plan-save">
                    {t("subscription.saveLabel", { amount: (plans.monthly.amount * 12 - plans.yearly.amount) / 100 })}
                  </Text>
                )}
                <Button
                  className={`plan-btn ${isRecommended ? "plan-btn-primary" : "plan-btn-outline"}`}
                  onClick={() => handleBuy(type)}
                >
                  {t("subscription.activateNow")}
                </Button>
              </View>
            )
          })}
        </View>
      </ScrollView>

      {/* Payment confirmation modal */}
      {showConfirm && (
        <View className="overlay" onClick={() => setShowConfirm(null)}>
          <View className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <Text className="confirm-title">{t("subscription.confirmTitle")}</Text>
            <Text className="confirm-msg">
              {t("subscription.confirmMsg", {
                amount: formatYuan(plans[showConfirm]?.amount || 0),
                name: planInfoMap[showConfirm]?.name || "",
              })}
            </Text>
            <View className="confirm-actions">
              <Button className="confirm-cancel" onClick={() => setShowConfirm(null)}>
                {t("common.cancel")}
              </Button>
              <Button className="confirm-ok" onClick={() => confirmPay(showConfirm)}>
                {t("common.confirm")}
              </Button>
            </View>
          </View>
        </View>
      )}

      <FloatingExpertButton />
    </View>
  )
}
