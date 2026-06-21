import { create } from 'zustand'
import Taro from '@tarojs/taro'

interface AuthState {
  userId: string
  memberId: string
  token: string
  isLoggedIn: boolean
  phoneVerified: boolean
  init: () => void
  setAuth: (userId: string, memberId: string, token?: string, phoneVerified?: boolean) => void
  setPhoneVerified: () => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: '',
  memberId: '',
  token: '',
  isLoggedIn: false,
  phoneVerified: false,
  init: () => {
    const uid = Taro.getStorageSync('member_id') || ''
    const mid = Taro.getStorageSync('epicarena_member_id') || ''
    const tok = Taro.getStorageSync('auth_token') || ''
    if (uid) set({ userId: uid, memberId: mid || uid, token: tok, isLoggedIn: true, phoneVerified: Taro.getStorageSync('phone_verified') === 'true' })
  },
  setAuth: (userId, memberId, token = '', phoneVerified = false) => {
    Taro.setStorageSync('member_id', userId)
    Taro.setStorageSync('epicarena_member_id', memberId)
    if (token) Taro.setStorageSync('auth_token', token)
    Taro.setStorageSync('phone_verified', String(phoneVerified))
    set({ userId, memberId, token, isLoggedIn: true, phoneVerified })
  },
  setPhoneVerified: () => {
    Taro.setStorageSync('phone_verified', 'true')
    set({ phoneVerified: true })
  },
  clearAuth: () => {
    Taro.removeStorageSync('member_id')
    Taro.removeStorageSync('epicarena_member_id')
    Taro.removeStorageSync('auth_token')
    Taro.removeStorageSync('phone_verified')
    set({ userId: '', memberId: '', token: '', isLoggedIn: false, phoneVerified: false })
  },
}))