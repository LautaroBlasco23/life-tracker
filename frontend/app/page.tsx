"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/services/auth-service"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to activities if authenticated, otherwise to login
    if (authService.isAuthenticated()) {
      router.push("/activities")
    } else {
      router.push("/login")
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-muted-foreground">Redirecting...</div>
    </div>
  )
}
