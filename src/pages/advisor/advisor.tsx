import { View, Text } from "@tarojs/components"
import { t } from "@/i18n"
import FloatingExpertButton from "@/components/FloatingExpertButton"

export default function AdvisorPage() {
  return (
    <View className="page">
      <View className="page-center">
        <Text style={{ color: "#86909C" }}>{t("common.comingSoon")}</Text>
      </View>
      <FloatingExpertButton />
    </View>
  )
}
