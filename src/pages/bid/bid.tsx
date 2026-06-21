import { useState } from "react"
import { View, Text, Button, Picker } from "@tarojs/components"
import Taro, { useLoad } from "@tarojs/taro"
import { t } from "@/i18n"
import { apiGet, apiPost } from "@/lib/api"
import type { Template, MissingItem } from "@/types"
import "./bid.scss"

export default function BidPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [template, setTemplate] = useState("standard")
  const [missing, setMissing] = useState<MissingItem[]>([])
  const [generating, setGenerating] = useState(false)
  const [fileId, setFileId] = useState("")

  useLoad(({ fileId: fid }: { fileId?: string } = {}) => {
    if (fid) setFileId(fid)
    loadTemplates()
  })

  const loadTemplates = async () => {
    try {
      const r = await apiGet<{ success: boolean; templates: Template[] }>("/api/bid/templates")
      setTemplates(r.templates || [])
    } catch { /* ignore */ }
  }

  const checkMissing = async () => {
    if (!fileId) return
    try {
      const r = await apiPost<{ success: boolean; missing_items: MissingItem[] }>(
        "/api/bid/missing-items", { file_id: fileId },
      )
      setMissing(r.missing_items || [])
    } catch { /* ignore */ }
  }

  const generate = async () => {
    if (!fileId) {
      Taro.showToast({ title: t("bid.needUpload"), icon: "none" })
      return
    }
    setGenerating(true)
    try {
      const r = await apiPost<{ success: boolean; task_id: string }>("/api/bid/generate", {
        file_id: fileId,
        template_id: template,
      })
      const tid = r.task_id
      if (tid) Taro.navigateTo({ url: `/pages/preview/preview?taskId=${tid}` })
    } catch (e: unknown) {
      Taro.showToast({ title: (e as Error).message || t("bid.generateFailed"), icon: "none" })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <View className="page">
      <View className="section">
        <Text className="section-title">{t("bid.selectTemplate")}</Text>
        <Picker
          mode="selector"
          range={templates.map((tpl) => tpl.name)}
          value={templates.findIndex((tpl) => tpl.id === template)}
          onChange={(e) => { const idx = Number(e.detail.value); setTemplate(templates[idx].id) }}
        >
          <View className="picker">
            {templates.find((tpl) => tpl.id === template)?.name || t("bid.standardTemplate")}
          </View>
        </Picker>
        {templates.find((tpl) => tpl.id === template) && (
          <Text className="hint">
            {t("bid.techSections", { count: templates.find((tpl) => tpl.id === template)!.tech_sections })}
            {" + "}
            {t("bid.commercialSections", { count: templates.find((tpl) => tpl.id === template)!.comm_sections })}
          </Text>
        )}
      </View>

      {missing.length > 0 && (
        <View className="section">
          <Text className="section-title">{t("bid.missingTitle", { count: missing.length })}</Text>
          {missing.map((m, i) => (
            <View key={i} className="missing-item">
              <Text className="missing-name">
                {m.urgency === t("bid.required") ? "[必须]" : m.urgency === t("bid.suggested") ? "[建议]" : "[加分]"} {m.name}
              </Text>
              <Text className="missing-desc">{m.note}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="actions">
        <Button className="btn-outline" onClick={checkMissing}>{t("bid.checkMissing")}</Button>
        <Button className="btn-primary" onClick={generate} disabled={generating} loading={generating}>
          {generating ? t("bid.generating") : t("bid.generate")}
        </Button>
      </View>
    </View>
  )
}
