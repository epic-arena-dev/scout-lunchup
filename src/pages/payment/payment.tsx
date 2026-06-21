import { useState, useCallback, useEffect } from "react"
import { View, Text, Button, ScrollView } from "@tarojs/components"
import Taro, { useLoad } from "@tarojs/taro"
import { t } from "@/i18n"
import { fetchPlans, createOrder, requestPayment } from "@/services/payment"
import type { PlanInfo } from "@/types"
import "./payment.scss"

type PayState = "loading" | "ready" | "paying" | "success" | "failed" | "cancelled"

const PLAN_ORDER = ["single_download", "monthly", "yearly"] as const
type PlanType = (typeof PLAN_ORDER)[number]

const PLAN_LABELS: Record<PlanType, string> = {
  single_download: "subscription.singleDownload",
  monthly: "subscription.monthlyPlan",
  yearly: "subscription.yearlyPlan",
}

const PLAN_DESCS: Record<PlanType, string> = {
  single_download: "subscription.singleDesc",
  monthly: "subscription.unlimitedDownload",
  yearly: "subscription.unlimitedDownload",
}

export default function PaymentPage() {
  const [state, setState] = useState<PayState>("loading")
  const [plans, setPlans] = useState<Record<string, PlanInfo>>({})
  const [planType, setPlanType] = useState<PlanType>("monthly")
  const [error, setError] = useState("")

  useLoad((options) => {
    const type = (options?.planType as PlanType) || "monthly"
    if (PLAN_ORDER.includes(type)) {
      setPlanType(type)
    }
  })

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = useCallback(async () => {
    setState("loading")
    setError("")
    try {
      const data = await fetchPlans()
      setPlans(data)
      setState("ready")
    } catch {
      setError(t("payment.loadFailed"))
      setState("failed")
    }
  }, [])

  // ---- Start WeChat JSAPI payment flow ----
  const handlePay = useCallback(async () => {
    if (!planType) return
    setState("paying")
    setError("")

    try {
      // Step 1: Create order → backend returns WeChat JSAPI params
      const { payParams } = await createOrder(planType)

      // Step 2: Invoke WeChat JSAPI payment (native pay sheet)
      const result = await requestPayment(payParams)

      // Step 3: Handle result
      if (result.ok) {
        setState("success")
      } else if (result.reason === "cancel") {
        setState("cancelled")
        setError(t("payment.payCancel"))
      } else {
        setError(result.message || t("payment.payFailed"))
        setState("failed")
      }
    } catch (e: unknown) {
      setError((e as Error)?.message || t("payment.payFailed"))
      setState("failed")
    }
  }, [planType])

  const handleRetry = useCallback(() => {
    setState("ready")
    setError("")
  }, [])

  const handleGoMember = useCallback(() => {
    Taro.switchTab({ url: "/pages/profile/profile" })
  }, [])

  const handleBack = useCallback(() => {
    Taro.navigateBack()
  }, [])

  // ---- Compute display values ----
  const planInfo = plans[planType] ?? null
  const isRecommended = planType === "monthly"
  const amountYuan = planInfo ? planInfo.amount / 100 : 0
  const priceText =
    amountYuan % 1 === 0 ? `¥${amountYuan}` : `¥${amountYuan.toFixed(2)}`

  // Calculate yearly savings vs monthly
  const monthlyPlan = plans.monthly
  const yearlyPlan = plans.yearly
  const yearlySaving =
    yearlyPlan && monthlyPlan
      ? (monthlyPlan.amount * 12 - yearlyPlan.amount) / 100
      : 0

  // ---- Loading state ----
  if (state === "loading") {
    return (
      <View className="page-center">
        <View className="pay-loading">
          <View className="pay-spinner" />
          <Text className="pay-loading-text">{t("common.loading")}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="page">
      <ScrollView scrollY className="pay-scroll">
        {/* ---- Header ---- */}
        <View className="pay-header">
          <Text className="pay-header-icon">💳</Text>
          <Text className="pay-header-title">{t("payment.title")}</Text>
          <Text className="pay-header-sub">{t("payment.subtitle")}</Text>
        </View>

        {/* ---- Plan Card ---- */}
        <View className={`pay-plan-card ${isRecommended ? "pay-plan-recommended" : ""}`}>
          {isRecommended && (
            <View className="pay-recommend-tag">
              <Text className="pay-recommend-text">{t("subscription.recommend")}</Text>
            </View>
          )}
          <Text className="pay-plan-name">{t(PLAN_LABELS[planType])}</Text>
          <Text className="pay-plan-desc">{t(PLAN_DESCS[planType])}</Text>

          <View className="pay-divider" />

          {/* Amount */}
          <View className="pay-amount-section">
            <Text className="pay-amount-label">{t("payment.totalAmount")}</Text>
            <View className="pay-amount-row">
              <Text className="pay-amount-symbol">¥</Text>
              <Text className="pay-amount-value">{priceText.replace("¥", "")}</Text>
              {planType === "monthly" && (
                <Text className="pay-amount-unit">{t("subscription.perMonth")}</Text>
              )}
              {planType === "yearly" && (
                <Text className="pay-amount-unit">{t("subscription.perYear")}</Text>
              )}
            </View>
            {planType === "yearly" && yearlySaving > 0 && (
              <Text className="pay-amount-save">
                {t("subscription.saveLabel", { amount: yearlySaving })}
              </Text>
            )}
          </View>
        </View>

        {/* ---- Payment method ---- */}
        <View className="pay-method-section">
          <Text className="pay-method-title">{t("payment.method")}</Text>
          <View className="pay-method-card">
            <View className="pay-method-left">
              <Text className="pay-method-icon">💚</Text>
              <View className="pay-method-text">
                <Text className="pay-method-name">{t("payment.wechatPay")}</Text>
                <Text className="pay-method-desc">{t("payment.wechatPayDesc")}</Text>
              </View>
            </View>
            <View className="pay-method-check">
              <View className="pay-check-dot" />
            </View>
          </View>
        </View>

        {/* ---- Error / Status banner ---- */}
        {(state === "failed" || state === "cancelled") && error && (
          <View className="pay-banner pay-banner-error">
            <Text className="pay-banner-icon">
              {state === "cancelled" ? "⚠️" : "❌"}
            </Text>
            <Text className="pay-banner-text">{error}</Text>
          </View>
        )}

        {/* ---- Action buttons ---- */}
        <View className="pay-actions">
          {state === "ready" && (
            <Button className="pay-btn-primary" onClick={handlePay}>
              <Text className="pay-btn-icon">💳</Text>
              <Text>{t("payment.payNow", { amount: priceText })}</Text>
            </Button>
          )}

          {state === "paying" && (
            <View className="pay-paying-section">
              <View className="pay-paying-spinner">
                <View className="pay-spinner-ring" />
              </View>
              <Text className="pay-paying-text">{t("payment.paying")}</Text>
              <Text className="pay-paying-hint">{t("payment.payingHint")}</Text>
            </View>
          )}

          {state === "success" && (
            <View className="pay-success-section">
              <View className="pay-success-icon-wrap">
                <Text className="pay-success-icon">✅</Text>
              </View>
              <Text className="pay-success-title">{t("payment.successTitle")}</Text>
              <Text className="pay-success-desc">{t("payment.successDesc")}</Text>
              <Button className="pay-btn-primary" onClick={handleGoMember}>
                {t("payment.goMember")}
              </Button>
            </View>
          )}

          {(state === "failed" || state === "cancelled") && (
            <View className="pay-retry-section">
              <Text className="pay-retry-title">
                {state === "cancelled" ? t("payment.cancelledTitle") : t("payment.failedTitle")}
              </Text>
              <Text className="pay-retry-desc">{error}</Text>
              <View className="pay-retry-actions">
                <Button className="pay-btn-outline" onClick={handleBack}>
                  {t("common.cancel")}
                </Button>
                <Button className="pay-btn-primary" onClick={handleRetry}>
                  {t("payment.retry")}
                </Button>
              </View>
            </View>
          )}
        </View>

        {/* ---- Footer note ---- */}
        <View className="pay-footer">
          <Text className="pay-footer-text">{t("payment.secureNote")}</Text>
        </View>
      </ScrollView>
    </View>
  )
}
