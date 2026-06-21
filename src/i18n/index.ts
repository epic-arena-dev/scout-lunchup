import i18n from 'i18next'
import zhCN from './zh-CN.json'
import enUS from './en-US.json'

i18n.init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
})

export const t = i18n.t.bind(i18n)
export default i18n
