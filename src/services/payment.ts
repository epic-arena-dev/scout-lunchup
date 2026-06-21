import Taro from "@tarojs/taro"
import { apiPost, apiGet } from "@/lib/api"
import type { PlanInfo, WechatPayParams } from "@/types"

/**
 * WeChat JSAPI Payment service.
 *
 * Flow: create order → receive WeChat pay params → invoke JSAPI → handle result.
 * The backend is responsible for calling the WeChat Payment Unified Order API
 * and returning signed JSAPI parameters.
 */

// ── API calls ──

/** Fetch available plans */
export async function fetchPlans(): Promise<Record<string, PlanInfo>> {
  const r = await apiGet<{ success: boolean; data: Record<string, PlanInfo> }>(
    "/api/payment/plans",
  )
  return r.data ?? {}
}

/** Create a payment order and get WeChat JSAPI params */
export async function createOrder(
  planType: string,
): Promise<{ orderId: string; payParams: WechatPayParams }> {
  const r = await apiPost<{
    success: boolean
    data: { id: string; pay_params: WechatPayParams }
    message?: string
  }>("/api/payment/create", { plan_type: planType })

  if (!r.success || !r.data?.pay_params) {
    throw new Error(r.message || "Failed to create order")
  }

  return {
    orderId: r.data.id,
    payParams: r.data.pay_params,
  }
}

// ── WeChat JSAPI ──

export type PayResult =
  | { ok: true }
  | { ok: false; reason: "cancel" | "fail" | "error"; message: string }

/**
 * Invoke WeChat JSAPI payment. This opens the native WeChat payment sheet.
 * Returns { ok: true } on success, or { ok: false, reason } on failure.
 */
export async function requestPayment(params: WechatPayParams): Promise<PayResult> {
  try {
    await Taro.requestPayment({
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType || "RSA",
      paySign: params.paySign,
    })
    return { ok: true }
  } catch (err: unknown) {
    const msg = String((err as { errMsg?: string })?.errMsg || err || "")
    if (msg.includes("cancel")) {
      return { ok: false, reason: "cancel", message: "Payment cancelled" }
    }
    return { ok: false, reason: "fail", message: msg || "Payment failed" }
  }
}

/**
 * Full payment flow: create order → invoke WeChat payment.
 * The caller handles UI state (loading, error display) around this call.
 */
export async function payForPlan(planType: string): Promise<PayResult> {
  // 1. Create order
  const { payParams } = await createOrder(planType)

  // 2. Invoke JSAPI
  return requestPayment(payParams)
}
