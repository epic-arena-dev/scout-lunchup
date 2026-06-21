import { useState, useEffect, useRef, useCallback } from "react"
import { View, Text, Image, ScrollView, Input } from "@tarojs/components"
import Taro, { useLoad } from "@tarojs/taro"
import { t } from "@/i18n"
import { apiGet, apiPost } from "@/lib/api"
import type { Expert, ExpertChatMessage, ExpertChatResponse, ApiResponse } from "@/types"
import "./expert-chat.scss"

const QUOTA_TOTAL = 20

export default function ExpertChatPage() {
  const [expert, setExpert] = useState<Expert | null>(null)
  const [messages, setMessages] = useState<ExpertChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState("")
  const [quotaRemaining, setQuotaRemaining] = useState(QUOTA_TOTAL)
  const [tokensUsed, setTokensUsed] = useState(0)
  const msgEndRef = useRef<HTMLDivElement>(null)

  useLoad((options) => {
    const expertId = options.expertId || ""
    const expertName = decodeURIComponent(options.expertName || "")
    const expertIndustry = decodeURIComponent(options.expertIndustry || "")
    if (expertId) {
      loadExpert(expertId, expertName, expertIndustry)
    } else {
      setLoading(false)
      setError(t("expert.invalidExpert", "无效的专家信息"))
    }
  })

  const loadExpert = async (
    id: string,
    presetName: string,
    presetIndustry: string,
  ) => {
    setLoading(true)
    setError("")
    try {
      const r = await apiGet<
        ApiResponse<{ experts: Expert[] }>
      >("/api/expert/experts")
      const experts = r.data?.experts || []
      const found = experts.find((e) => e.id === id)
      if (found) {
        setExpert(found)
      } else {
        // Use route params as fallback if expert not in list
        setExpert({
          id,
          name: presetName || "专家",
          industry: presetIndustry || "暖通",
          tags: [],
          online: true,
        })
      }
      loadHistory(id)
    } catch (e: unknown) {
      // Fallback with route params
      setExpert({
        id,
        name: presetName || "专家",
        industry: presetIndustry || "暖通",
        tags: [],
        online: true,
      })
      setMessages([
        {
          role: "expert",
          content: t("expert.welcome", {
            name: presetName || "专家",
            industry: presetIndustry || "暖通",
            defaultValue: `你好！我是${presetName || "专家"}，${presetIndustry || "暖通"}领域专家。有什么可以帮助你的？`,
          }),
          time: new Date().toISOString(),
        },
      ])
      setLoading(false)
    }
  }

  const loadHistory = async (expertId: string) => {
    setLoadingHistory(true)
    try {
      const r = await apiGet<
        ApiResponse<{ messages: ExpertChatMessage[] }>
      >(`/api/expert/history?expert_id=${expertId}`)
      const history = r.data?.messages || []
      if (history.length > 0) {
        setMessages(history)
      } else if (expert) {
        // Insert welcome message if no history
        setMessages([
          {
            role: "expert",
            content: t("expert.welcome", {
              name: expert.name,
              industry: expert.industry,
              defaultValue: `你好！我是${expert.name}，${expert.industry}领域专家。有什么可以帮助你的？`,
            }),
            time: new Date().toISOString(),
          },
        ])
      }
    } catch {
      if (expert) {
        setMessages([
          {
            role: "expert",
            content: t("expert.welcome", {
              name: expert.name,
              industry: expert.industry,
              defaultValue: `你好！我是${expert.name}，${expert.industry}领域专家。有什么可以帮助你的？`,
            }),
            time: new Date().toISOString(),
          },
        ])
      }
    } finally {
      setLoadingHistory(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    // Auto scroll to bottom
    if (msgEndRef.current) {
      setTimeout(() => {
        // Taro mini-program doesn't support scrollIntoView well,
        // so we use scroll-top on ScrollView
      }, 100)
    }
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !expert || sending) return

    setInput("")
    setSending(true)
    const userMsg: ExpertChatMessage = {
      role: "user",
      content: text,
      time: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const r = await apiPost<
        ApiResponse<ExpertChatResponse>
      >("/api/expert/chat", {
        expert_id: expert.id,
        message: text,
      })
      const chatResp = r.data
      const replyMsg: ExpertChatMessage = {
        role: "expert",
        content: chatResp.reply,
        time: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, replyMsg])
      setTokensUsed(
        (prev) => prev + (chatResp.tokens_used || 0),
      )
      setQuotaRemaining(chatResp.quota_remaining ?? QUOTA_TOTAL)
      setError("")
    } catch (e: unknown) {
      setError((e as Error).message || t("expert.sendFailed", "发送失败"))
    } finally {
      setSending(false)
    }
  }, [input, expert, sending])

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      const h = d.getHours().toString().padStart(2, "0")
      const m = d.getMinutes().toString().padStart(2, "0")
      return `${h}:${m}`
    } catch {
      return ""
    }
  }

  const quotaPercent = Math.max(
    0,
    Math.min(100, (quotaRemaining / QUOTA_TOTAL) * 100),
  )

  return (
    <View className="chat-page">
      {/* Header */}
      <View className="chat-header">
        <Text
          className="chat-header-back"
          onClick={() => Taro.navigateBack()}
        >
          &lt; {t("common.back")}
        </Text>
        {expert && (
          <>
            <View className="chat-header-avatar">
              {expert.avatar ? (
                <Image
                  className="chat-header-avatar-img"
                  src={expert.avatar}
                  mode="aspectFill"
                />
              ) : (
                <Text className="chat-header-avatar-text">
                  {expert.name.charAt(0)}
                </Text>
              )}
            </View>
            <View className="chat-header-info">
              <View className="chat-header-name-row">
                <Text className="chat-header-name">{expert.name}</Text>
                <View
                  className="chat-header-dot"
                  style={{
                    background: expert.online
                      ? "#00B42A"
                      : "#ccc",
                  }}
                />
              </View>
              <Text className="chat-header-industry">
                {expert.industry}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Quota Bar */}
      <View className="chat-quota-bar">
        <Text className="chat-quota-label">
          {t("expert.quota", "今日额度")}
        </Text>
        <View className="chat-quota-track">
          <View
            className="chat-quota-fill"
            style={{ width: `${quotaPercent}%` }}
          />
        </View>
        <Text className="chat-quota-text">
          {quotaRemaining}/{QUOTA_TOTAL}
        </Text>
      </View>

      {/* Messages */}
      <ScrollView
        scrollY
        className="chat-messages"
        scrollWithAnimation
        scrollTop={999999}
      >
        {loading ? (
          <View className="chat-loading">
            <View className="chat-loading-dots">
              <View className="chat-loading-dot" />
              <View className="chat-loading-dot" />
              <View className="chat-loading-dot" />
            </View>
            <Text className="chat-loading-text">
              {t("common.loading")}
            </Text>
          </View>
        ) : error && messages.length === 0 ? (
          <View className="chat-error">
            <Text className="chat-error-text">{error}</Text>
            <View
              className="chat-error-btn"
              onClick={() => {
                if (expert) {
                  setLoading(true)
                  setError("")
                  loadHistory(expert.id)
                }
              }}
            >
              <Text>{t("expert.retry", "重试")}</Text>
            </View>
          </View>
        ) : messages.length === 0 ? (
          <View className="chat-empty">
            <Text className="chat-empty-text">
              {t("expert.emptyHint", "开始对话吧")}
            </Text>
          </View>
        ) : (
          <>
            {messages.map((msg, i) => (
              <View
                key={i}
                className={`msg-row ${
                  msg.role === "user"
                    ? "msg-row-user"
                    : "msg-row-expert"
                }`}
              >
                <View className="msg-avatar">
                  {msg.role === "user" ? (
                    <Text className="msg-avatar-text msg-avatar-user">
                      我
                    </Text>
                  ) : expert?.avatar ? (
                    <Image
                      className="msg-avatar-img"
                      src={expert.avatar}
                      mode="aspectFill"
                    />
                  ) : (
                    <Text className="msg-avatar-text">
                      {expert?.name?.charAt(0) || "专"}
                    </Text>
                  )}
                </View>
                <View>
                  <View
                    className={`msg-bubble ${
                      msg.role === "user"
                        ? "msg-bubble-user"
                        : "msg-bubble-expert"
                    }`}
                  >
                    <Text>{msg.content}</Text>
                  </View>
                  <Text
                    className={`msg-time ${
                      msg.role === "user"
                        ? "msg-time-user"
                        : ""
                    }`}
                  >
                    {formatTime(msg.time)}
                  </Text>
                </View>
              </View>
            ))}

            {/* Sending Indicator */}
            {sending && (
              <View className="msg-row msg-row-expert">
                <View className="msg-avatar">
                  <Text className="msg-avatar-text">
                    {expert?.name?.charAt(0) || "专"}
                  </Text>
                </View>
                <View className="msg-bubble msg-bubble-expert">
                  <View className="msg-sending">
                    <View className="msg-sending-dot" />
                    <View className="msg-sending-dot" />
                    <View className="msg-sending-dot" />
                  </View>
                </View>
              </View>
            )}

            {error && messages.length > 0 && (
              <View className="chat-error">
                <Text className="chat-error-text">{error}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View className="chat-input-bar">
        <Input
          className="chat-input"
          type="text"
          value={input}
          placeholder={t("expert.inputPlaceholder", "输入消息...")}
          onInput={(e) => setInput(e.detail.value)}
          onConfirm={handleSend}
          confirmType="send"
          disabled={sending || !expert}
        />
        <View
          className={`chat-send-btn ${
            !input.trim() || sending ? "chat-send-btn-disabled" : ""
          }`}
          onClick={handleSend}
        >
          <Text>{t("expert.send", "发送")}</Text>
        </View>
      </View>
    </View>
  )
}
