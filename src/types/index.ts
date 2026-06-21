export interface ApiResponse<T> { success: boolean; data: T; message?: string }

export interface FileItem {
  id: string; filename: string; file_type: string; file_size: number
  status: string; created_at: string
}

export interface CheckResult {
  check_item_id: string; title: string; category: string
  risk_level: 'critical' | 'high' | 'pass'; result: string
  suggestions: string[]; evidence: string
}

export interface Template {
  id: string; name: string
  tech_sections: number; comm_sections: number
}

export interface MissingItem {
  name: string; category: string; required_by: string
  urgency: string; note: string
}

export interface BidSection { title: string; content: string; status: string }

export interface BidResult {
  task_id: string; status: string; template: string
  tech_bid: { sections: BidSection[] }
  comm_bid: { sections: BidSection[] }
  missing_items: string[]; created_at: string
}

export interface UploadResult { file_id: string; filename: string }

export interface CollisionResult {
  is_blocked: boolean
  project_id: string | null
  match_score: number | null
  extracted_name: string | null
  extracted_number: string | null
}

export interface ViewRecord {
  url: string; generatedAt: string; expiresAt: string
}

export interface UserProfile {
  id: string; member_id: string; phone: string | null
  phone_verified: boolean; nickname: string; avatar: string | null
  status: string; created_at: string
}

export interface PointsAccount {
  user_id: string; nickname: string; balance: number
  total_earned: number; total_spent: number; yi: number; star: number
}

export interface MembershipInfo {
  is_member: boolean; plan_type: string | null
  started_at?: string; expires_at?: string; days_left: number
}

export interface CheckInResult {
  user_id: string; balance: number; amount: number
  total_earned: number; total_spent: number; streak: number
}

export interface OrderItem {
  id: string; order_type: string; amount: number; status: string
  file_id?: string; paid_at?: string; created_at: string
}

export interface PointsTransaction {
  id: number; change_type: string; amount: number
  balance_after: number; reference_id?: string; description: string
  created_at: string
}

export interface PlanInfo {
  type: string; amount: number; label: string; unit: string
}

export interface Expert {
  id: string
  name: string
  avatar?: string
  industry: string
  tags: string[]
  online: boolean
}

export interface ExpertChatMessage {
  role: "user" | "expert"
  content: string
  time: string
}

export interface ExpertChatResponse {
  reply: string
  tokens_used: number
  quota_remaining: number
}

export interface OcrResult {
  file_id: string
  project_name?: string
  project_number?: string
  deadline?: string
  budget?: string
  purchaser?: string
  bidding_agency?: string
  raw_text: string
  confidence: number
}

export interface WechatPayParams {
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}
