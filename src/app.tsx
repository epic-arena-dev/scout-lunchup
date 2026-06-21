import { PropsWithChildren } from "react"
import { useLaunch, useError } from "@tarojs/taro"
import Taro from "@tarojs/taro"
import { useAuthStore } from "./stores/authStore"
import { useAppStore } from "./stores/appStore"
import { apiPost } from "./lib/api"
import "./i18n"
import "./app.scss"
import { API_BASE } from "./lib/config"

interface LoginResponse {
  id: string
  member_id: string
  phone_verified: boolean
}

const TAB_BAR_PAGES = ["pages/dashboard/dashboard", "pages/projects/projects", "pages/advisor/advisor", "pages/profile/profile"]

function applyTheme(colors: Record<string, string>) {
  try { Taro.setNavigationBarColor({ frontColor: "#ffffff", backgroundColor: colors.primary || "#165DFF" }) } catch {}
  const pages = Taro.getCurrentPages()
  const route = pages.length > 0 ? pages[pages.length - 1]?.route : ""
  if (!route || TAB_BAR_PAGES.includes(route)) {
    try { Taro.setTabBarStyle({
      color: colors.warmMuted || "#6B5E53",
      selectedColor: colors.primary || "#165DFF",
      backgroundColor: "#ffffff",
      borderStyle: "white",
    }) } catch {}
  }
}

export default function App({ children }: PropsWithChildren) {
  const init = useAuthStore((s) => s.init)
  const setAuth = useAuthStore((s) => s.setAuth)
  const setTheme = useAppStore((s) => s.setTheme)

  useLaunch(() => {
    init()
    // 拉取主题（无需登录）
    void (async () => {
      try {
        const res = await Taro.request({ url: `${API_BASE}/api/theme`, timeout: 8000 })
        const json = res.data as { success: boolean; data: { id: string; name: string; colors: Record<string, string>; is_active: boolean } }
        if (json.success && json.data) {
          setTheme(json.data)
          applyTheme(json.data.colors)
        }
      } catch { /* use defaults */ }
    })()
    void (async () => {
      const { isLoggedIn, phoneVerified } = useAuthStore.getState()
      if (isLoggedIn && phoneVerified) return

      try {
        const loginRes = await Taro.login()
        if (!loginRes.code) {
          console.warn("Taro.login returned no code")
          return
        }
        const r = await apiPost<{ success: boolean; data: LoginResponse }>(
          "/api/account/login/wechat", { code: loginRes.code },
        )
        if (r.data?.id) {
          setAuth(r.data.id, r.data.member_id, r.data.token, r.data.phone_verified)
          if (!r.data.phone_verified) {
            Taro.redirectTo({ url: "/pages/login/login" })
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message?.includes("timeout")) {
          console.warn("Login request timed out — check network/backend")
        }
        console.warn("Silent login failed:", e)
      }
    })()
  })

  useError((err) => console.error("MiniProgram error:", err))

  return <>{children}</>
}
