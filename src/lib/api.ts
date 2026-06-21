import Taro from "@tarojs/taro"
import { API_BASE } from "./config"
import { useAuthStore } from "../stores/authStore"
import type { ApiResponse, UploadResult } from "../types"

function getToken(): string {
  return useAuthStore.getState().token || ""
}

async function request<T>(method: "GET" | "POST", path: string, data?: unknown): Promise<T> {
  const header: Record<string, string> = { "Content-Type": "application/json" }
  const token = getToken()
  if (token) header["Authorization"] = `Bearer ${token}`

  const res = await Taro.request({
    url: API_BASE + path,
    method,
    header,
    data: data as Record<string, unknown> | undefined,
    timeout: 30000,
  })

  if (res.statusCode >= 400) {
    const msg = (res.data as { message?: string })?.message || "请求失败"
    throw new Error(msg)
  }
  return res.data as T
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path)
}

export function apiPost<T>(path: string, data?: unknown): Promise<T> {
  return request<T>("POST", path, data)
}

export function apiUpload(
  filePath: string,
  formData?: Record<string, string>,
  onProgress?: (p: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadTask = Taro.uploadFile({
      url: API_BASE + "/api/upload",
      filePath,
      name: "file",
      formData,
      header: { "Authorization": `Bearer ${getToken()}` },
      success: (res) => {
        const data = JSON.parse(res.data) as ApiResponse<UploadResult>
        if (data.success) resolve(data.data)
        else reject(new Error(data.message || "上传失败"))
      },
      fail: reject,
    })
    if (onProgress) {
      uploadTask.onProgressUpdate((res) => onProgress(res.progress))
    }
  })
}

