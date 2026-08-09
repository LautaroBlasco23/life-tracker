import { DayOfWeek, DayTime, Frequency } from "@/types/activity"

export interface CreateActivityRequest {
  title: string
  description: string
  completionAmount: number
  frequency: Frequency
  dayFrequency?: DayOfWeek[]
  dayTime: DayTime
}

export interface UpdateActivityRequest {
  title?: string
  description?: string
  completionAmount?: number
  frequency?: Frequency
  dayFrequency?: DayOfWeek[]
  dayTime?: DayTime
  isActive?: boolean
}
