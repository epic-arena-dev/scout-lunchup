import { useState, useRef } from "react"
import { View, Text, Input, Button } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { t } from "@/i18n"
import { apiPost } from "@/lib/api"
import { useAuthStore } from "@/stores/authStore"
import "./login.scss"

export default function LoginPage() {
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState("")
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const setPhoneVerified = useAuthStore((s) => s.setPhoneVerified)
  const setAuth = useAuthStore((s) => s.setAuth)

  const startCountdown = () => {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const handleSendCode = async () => {
    setError("")
    if (!phone || phone.length < 11) {
      setError(t("auth.phoneInvalid") || "请输入有效手机号")
      return
    }
    setSending(true)
    try {
      await apiPost("/api/account/verify-code/send", { phone })
      startCountdown()
      Taro.showToast({ title: t("auth.codeSent"), icon: "none" })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ""
      setError(msg || t("auth.sendFailed"))
    } finally {
      setSending(false)
    }
  }

  const handleVerify = async () => {
    setError("")
    if (!code) {
      setError(t("auth.codeRequired") || "请输入验证码")
      return
    }
    setVerifying(true)
    try {
      const r = await apiPost<{ data?: { verified: boolean; user_id: string; member_id: string; merged?: boolean } }>(
        "/api/account/verify-phone", { phone, code },
      )
      if (r.data?.merged) {
        // 账号合并：更新为已有手机账号的 user_id
        setAuth(r.data.user_id, r.data.member_id, r.data.token, true)
      } else {
        setPhoneVerified()
      }
      Taro.showToast({ title: "验证成功", icon: "success" })
      setTimeout(() => Taro.switchTab({ url: "/pages/dashboard/dashboard" }), 800)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ""
      setError(msg || t("auth.loginFailed"))
    } finally {
      setVerifying(false)
    }
  }

  const canSubmit = phone.length >= 11 && code.length > 0 && !verifying

  return (
    <View className="login-page">
      <View className="login-avatar">
        <Text className="avatar-text">{phone ? phone.slice(-2) : "?"}</Text>
      </View>
      <Text className="login-title">{t("auth.title")}</Text>
      <Text className="login-hint">{t("auth.hint")}</Text>

      <View className="login-form">
        <View className="login-input-group">
          <View className="login-input-row">
            <Input
              className="login-input"
              type="number"
              maxlength={11}
              placeholder={t("auth.phonePlaceholder")}
              value={phone}
              onInput={(e) => setPhone(e.detail.value)}
            />
          </View>
          <View className="login-input-row">
            <Input
              className="login-input"
              type="number"
              maxlength={6}
              placeholder={t("auth.codePlaceholder")}
              value={code}
              onInput={(e) => setCode(e.detail.value)}
            />
            <Button
              className="login-send-btn"
              disabled={countdown > 0 || sending}
              onClick={handleSendCode}
            >
              {countdown > 0 ? `${countdown}s` : t("auth.sendCode")}
            </Button>
          </View>
        </View>

        <Button className="login-submit" disabled={!canSubmit} onClick={handleVerify}>
          {verifying ? (t("auth.verifying") || "验证中...") : t("auth.verifyLogin")}
        </Button>

        {error ? <Text className="login-error">{error}</Text> : null}
      </View>
    </View>
  )
}
