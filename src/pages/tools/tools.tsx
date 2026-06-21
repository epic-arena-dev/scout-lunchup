import { View, Text } from "@tarojs/components"
import Taro from "@tarojs/taro"
import "./tools.scss"

interface ToolCategory {
  key: string
  label: string
  desc: string
  icon: string
  tools: { name: string; desc: string; url: string }[]
}

const categories: ToolCategory[] = [
  {
    key: "doc",
    label: "Document Tools",
    desc: "PDF processing, format conversion, file compression",
    icon: "doc",
    tools: [
      { name: "PDF Merge", desc: "Merge multiple PDFs into one", url: "/tools/doc/pdf-merge" },
      { name: "Word to PDF", desc: "Convert Word to PDF format", url: "/tools/doc/word-to-pdf" },
      { name: "Image to PDF", desc: "Convert images to PDF", url: "/tools/doc/img-to-pdf" },
      { name: "File Compress", desc: "Compress to ZIP/GZip/BZip2", url: "/tools/doc/compress" },
    ],
  },
  {
    key: "calc",
    label: "Calculation Tools",
    desc: "HVAC unit conversion, duct & pipe sizing",
    icon: "calc",
    tools: [
      { name: "HVAC Unit Converter", desc: "Watt/BTU/Ton/HP conversion", url: "/tools/calc/hvac-unit" },
      { name: "Duct Sizing", desc: "Air volume / velocity / size", url: "/tools/calc/duct" },
      { name: "Pipe Sizing", desc: "Flow rate / diameter / velocity", url: "/tools/calc/pipe" },
    ],
  },
  {
    key: "cad",
    label: "CAD Tools",
    desc: "CAD viewer, format conversion, batch processing",
    icon: "cad",
    tools: [
      { name: "CAD to PDF", desc: "Batch convert DWG/DXF to PDF", url: "/tools/cad/to-pdf" },
      { name: "CAD Viewer", desc: "Online DWG/DXF file viewer", url: "/tools/cad/viewer" },
      { name: "CAD Version Convert", desc: "DWG/DXF R14-2024 conversion", url: "/tools/cad/convert" },
    ],
  },
  {
    key: "text",
    label: "Text Tools",
    desc: "JSON/YAML formatting, checksum calculation, text diff",
    icon: "text",
    tools: [
      { name: "JSON/YAML Formatter", desc: "Format, validate, convert", url: "/tools/text/format" },
      { name: "Checksum Calculator", desc: "MD5, SHA-1/256/512 hashing", url: "/tools/text/checksum" },
      { name: "Text Diff Tool", desc: "Compare text side by side", url: "/tools/text/diff" },
    ],
  },
]

const TOOLS_BASE = "https://tool.epicarena.cn"

export default function ToolsPage() {
  const openTool = (url: string) => {
    Taro.navigateTo({ url: `/pages/webview/webview?url=${encodeURIComponent(TOOLS_BASE + url)}` })
  }

  return (
    <View className="page tools-page">
      <View className="tools-header">
        <Text className="tools-title">Tool Station</Text>
        <Text className="tools-subtitle">Document, calculation, CAD & text utilities for HVAC bidding</Text>
      </View>

      <View className="tools-categories">
        {categories.map((cat) => (
          <View key={cat.key} className="tools-category">
            <View className="cat-header">
              <Text className="cat-icon">
                {cat.icon === "doc" && "📄"}
                {cat.icon === "calc" && "🔢"}
                {cat.icon === "cad" && "📐"}
                {cat.icon === "text" && "📝"}
              </Text>
              <View className="cat-info">
                <Text className="cat-label">{cat.label}</Text>
                <Text className="cat-desc">{cat.desc}</Text>
              </View>
              <Text className="cat-count">{cat.tools.length}</Text>
            </View>

            <View className="cat-tools">
              {cat.tools.map((tool) => (
                <View key={tool.name} className="tool-item" onClick={() => openTool(tool.url)}>
                  <View className="tool-info">
                    <Text className="tool-name">{tool.name}</Text>
                    <Text className="tool-desc">{tool.desc}</Text>
                  </View>
                  <Text className="tool-arrow">&gt;</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View className="tools-footer">
        <Text className="tools-footer-text">
          All tools run securely in your browser. No file uploads required for most tools.
        </Text>
      </View>
    </View>
  )
}
