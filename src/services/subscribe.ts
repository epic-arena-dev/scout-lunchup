import Taro from "@tarojs/taro"
import { apiPost, apiGet } from "@/lib/api"

/**
 * WeChat Subscribe Message service for bid alert push notifications.
 *
 * Template IDs are configured in the WeChat Mini-Program admin panel
 * (Settings > Subscribe Message). Replace placeholders with real IDs
 * after approval.
 */

// Template ID placeholders — replace with real WeChat-approved template IDs
export const SUBSCRIBE_TEMPLATES = {
  BID_MATCH: "BID_MATCH_TMPL_ID",
  DEADLINE_REMINDER: "DEADLINE_TMPL_ID",
  RESULT_NOTICE: "RESULT_TMPL_ID",
  SYSTEM_NOTICE: "SYSTEM_NOTICE_TMPL_ID",
} as const

export interface SubscribeSettings {
  bidMatch: boolean
  deadlineReminder: boolean
  resultNotice: boolean
  systemNotice: boolean
}

const STORAGE_KEY = "epic_subscribe_settings"

const DEFAULT_SETTINGS: SubscribeSettings = {
  bidMatch: false,
  deadlineReminder: false,
  resultNotice: false,
  systemNotice: false,
}

// ---- Storage helpers ----

export function getStoredSettings(): SubscribeSettings {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SubscribeSettings>
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch {
    /* corrupted storage, fall through */
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: SubscribeSettings): void {
  Taro.setStorageSync(STORAGE_KEY, JSON.stringify(settings))
}

// ---- WeChat API wrapper ----

export interface SubscribeResult {
  accepted: string[]
  rejected: string[]
}

/**
 * Invoke the WeChat subscribe message dialog.
 * Returns which template IDs the user accepted / rejected.
 */
export async function requestSubscribeMessage(
  tmplIds: string[],
): Promise<SubscribeResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await Taro.requestSubscribeMessage({ tmplIds })

    const accepted: string[] = []
    const rejected: string[] = []

    for (const id of tmplIds) {
      const status = res[id]
      if (status === "accept") {
        accepted.push(id)
      } else {
        // 'reject' | 'ban' | undefined
        rejected.push(id)
      }
    }

    return { accepted, rejected }
  } catch (err) {
    console.error("[subscribe] requestSubscribeMessage failed:", err)
    // On error (e.g. user denies, older WeChat version), treat all as rejected
    return { accepted: [], rejected: [...tmplIds] }
  }
}

/**
 * Open the mini-program's system settings page so the user can
 * manually toggle subscription message permissions.
 */
export async function openSubscribeSettings(): Promise<void> {
  try {
    await Taro.openSetting()
  } catch (err) {
    console.error("[subscribe] openSetting failed:", err)
  }
}

// ---- Backend sync helpers ----

export interface BackendSubscriptionStatus {
  bid_match: boolean
  deadline_reminder: boolean
  result_notice: boolean
  system_notice: boolean
}

/**
 * Fetch subscription preferences from the backend.
 * Falls back to local storage if the API is unavailable.
 */
export async function fetchSubscriptionStatus(): Promise<SubscribeSettings> {
  try {
    const r = await apiGet<{ success: boolean; data: BackendSubscriptionStatus }>(
      "/api/member/subscribe-status",
    )
    if (r?.data) {
      const merged: SubscribeSettings = {
        bidMatch: r.data.bid_match,
        deadlineReminder: r.data.deadline_reminder,
        resultNotice: r.data.result_notice,
        systemNotice: r.data.system_notice,
      }
      saveSettings(merged)
      return merged
    }
  } catch {
    /* backend may not have this endpoint yet */
  }
  return getStoredSettings()
}

/**
 * Persist subscription preferences to the backend.
 */
export async function syncSubscriptionStatus(
  settings: SubscribeSettings,
): Promise<boolean> {
  try {
    await apiPost("/api/member/subscribe-status", {
      bid_match: settings.bidMatch,
      deadline_reminder: settings.deadlineReminder,
      result_notice: settings.resultNotice,
      system_notice: settings.systemNotice,
    })
    saveSettings(settings)
    return true
  } catch {
    // Backend sync is best-effort; local state is always saved
    saveSettings(settings)
    return false
  }
}

/**
 * Toggle a single alert on/off.
 * - Turning ON: calls requestSubscribeMessage for that template; if accepted,
 *   updates local storage + backend sync.
 * - Turning OFF: updates local storage + backend sync immediately (no WeChat dialog).
 *
 * Returns the new enabled state, or null if the user rejected the WeChat dialog.
 */
export async function toggleSingleAlert(
  key: keyof SubscribeSettings,
  enable: boolean,
): Promise<boolean | null> {
  const settings = getStoredSettings()

  if (enable) {
    // Find the template ID for this key
    const tmplId = TEMPLATE_MAP[key]
    if (!tmplId) return null

    const result = await requestSubscribeMessage([tmplId])
    if (result.accepted.includes(tmplId)) {
      settings[key] = true
      saveSettings(settings)
      syncSubscriptionStatus(settings)
      return true
    }
    // User rejected — return null so caller can show guidance
    return null
  }

  // Turning OFF — no WeChat dialog needed
  settings[key] = false
  saveSettings(settings)
  syncSubscriptionStatus(settings)
  return false
}

// Map setting keys to template IDs
const TEMPLATE_MAP: Record<keyof SubscribeSettings, string> = {
  bidMatch: SUBSCRIBE_TEMPLATES.BID_MATCH,
  deadlineReminder: SUBSCRIBE_TEMPLATES.DEADLINE_REMINDER,
  resultNotice: SUBSCRIBE_TEMPLATES.RESULT_NOTICE,
  systemNotice: SUBSCRIBE_TEMPLATES.SYSTEM_NOTICE,
}

/**
 * Convenience: request all currently-disabled templates and mark them as
 * enabled if the user accepts.
 */
export async function enableAllAlerts(): Promise<SubscribeResult> {
  const current = getStoredSettings()
  const toRequest: string[] = []
  const mapping = new Map<string, keyof SubscribeSettings>()

  if (!current.bidMatch) {
    toRequest.push(SUBSCRIBE_TEMPLATES.BID_MATCH)
    mapping.set(SUBSCRIBE_TEMPLATES.BID_MATCH, "bidMatch")
  }
  if (!current.deadlineReminder) {
    toRequest.push(SUBSCRIBE_TEMPLATES.DEADLINE_REMINDER)
    mapping.set(SUBSCRIBE_TEMPLATES.DEADLINE_REMINDER, "deadlineReminder")
  }
  if (!current.resultNotice) {
    toRequest.push(SUBSCRIBE_TEMPLATES.RESULT_NOTICE)
    mapping.set(SUBSCRIBE_TEMPLATES.RESULT_NOTICE, "resultNotice")
  }
  if (!current.systemNotice) {
    toRequest.push(SUBSCRIBE_TEMPLATES.SYSTEM_NOTICE)
    mapping.set(SUBSCRIBE_TEMPLATES.SYSTEM_NOTICE, "systemNotice")
  }

  if (toRequest.length === 0) {
    return { accepted: [], rejected: [] }
  }

  const result = await requestSubscribeMessage(toRequest)

  // Update local state for accepted templates
  for (const id of result.accepted) {
    const key = mapping.get(id)
    if (key) current[key] = true
  }
  saveSettings(current)

  // Fire-and-forget backend sync
  syncSubscriptionStatus(current)

  return result
}
