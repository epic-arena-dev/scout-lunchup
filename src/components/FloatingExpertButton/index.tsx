import { useState, useEffect, useCallback } from "react"
import { View, Text, Image, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { t } from "@/i18n"
import { apiGet } from "@/lib/api"
import type { Expert } from "@/types"
import "./index.scss"

const MSG_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'%3E%3C/path%3E%3C/svg%3E"

export default function FloatingExpertButton() {
  const [experts, setExperts] = useState<Expert[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchExperts = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiGet<{ success: boolean; data: { experts: Expert[] } }>(
        "/api/expert/experts",
      )
      setExperts(r.data?.experts || [])
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExperts()
  }, [fetchExperts])

  const onlineCount = experts.filter((e) => e.online).length

  const handleExpertTap = (expert: Expert) => {
    setOpen(false)
    Taro.navigateTo({
      url: `/pages/expert-chat/expert-chat?expertId=${expert.id}&expertName=${encodeURIComponent(expert.name)}&expertIndustry=${encodeURIComponent(expert.industry)}`,
    })
  }

  return (
    <>
      {/* Floating Button */}
      <View className="fab-btn" onClick={() => setOpen(true)}>
        <Image className="fab-icon" src={MSG_ICON} />
        {onlineCount > 0 && (
          <View className="fab-badge">
            <Text className="fab-badge-text">
              {onlineCount > 99 ? "99+" : onlineCount}
            </Text>
          </View>
        )}
      </View>

      {/* Overlay */}
      {open && (
        <View className="fab-overlay" onClick={() => setOpen(false)}>
          <View
            className="fab-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Handle */}
            <View className="fab-drawer-handle">
              <View className="fab-drawer-handle-bar" />
            </View>

            {/* Drawer Header */}
            <View className="fab-drawer-header">
              <Text className="fab-drawer-title">
                {t("expert.title", "专家咨询")}
              </Text>
              <Text className="fab-drawer-count">
                {t("expert.onlineCount", { count: onlineCount })}
              </Text>
            </View>

            {/* Expert List */}
            <ScrollView scrollY className="fab-drawer-list">
              {loading ? (
                <View className="fab-loading">
                  <Text>{t("common.loading")}</Text>
                </View>
              ) : experts.length === 0 ? (
                <View className="fab-empty">
                  <Text className="fab-empty-text">
                    {t("expert.noExperts", "暂无可用专家")}
                  </Text>
                </View>
              ) : (
                experts.map((expert) => (
                  <View
                    key={expert.id}
                    className="fab-expert-card"
                    onClick={() => handleExpertTap(expert)}
                  >
                    <View className="fab-expert-avatar">
                      {expert.avatar ? (
                        <Image
                          className="fab-expert-avatar-img"
                          src={expert.avatar}
                          mode="aspectFill"
                        />
                      ) : (
                        <Text className="fab-expert-avatar-text">
                          {expert.name.charAt(0)}
                        </Text>
                      )}
                      <View
                        className={`fab-expert-dot ${expert.online ? "dot-online" : "dot-offline"}`}
                      />
                    </View>
                    <View className="fab-expert-info">
                      <Text className="fab-expert-name">{expert.name}</Text>
                      <Text className="fab-expert-industry">
                        {expert.industry}
                      </Text>
                      {expert.tags.length > 0 && (
                        <View className="fab-expert-tags">
                          {expert.tags.slice(0, 3).map((tag, i) => (
                            <View key={i} className="fab-expert-tag">
                              <Text className="fab-expert-tag-text">
                                {tag}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <Text className="fab-expert-arrow">&gt;</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </>
  )
}
