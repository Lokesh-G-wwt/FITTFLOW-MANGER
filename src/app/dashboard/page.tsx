import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get gym
  const { data: gym } = await supabase
    .from('gyms')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  // Get memberships for metrics
  let activeCount = 0
  let expiringCount = 0
  let totalRevenue = 0
  let members: any[] = []

  if (gym) {
    const { data: memberships } = await supabase
      .from('memberships')
      .select(`
        *,
        members (
          id,
          full_name,
          phone_number
        )
      `)
      .eq('gym_id', gym.id)
      .order('expiry_date', { ascending: true })

    if (memberships) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      memberships.forEach((m: any) => {
        const expiry = new Date(m.expiry_date)
        const isActive = expiry >= today
        if (isActive) {
          activeCount++
          totalRevenue += Number(m.total_paid || 0)
          const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          if (daysLeft <= 7) expiringCount++
        }
      })

      members = memberships.map((m: any) => ({
        id: m.id,
        name: m.members?.full_name || 'Unknown',
        phone: m.members?.phone_number || '',
        expiry: m.expiry_date,
        status: new Date(m.expiry_date) >= today ? 'active' : 'expired',
        plan: m.plan_duration_months,
        paid: m.total_paid,
      }))
    }
  }

  return (
    <DashboardClient
      user={user}
      profile={profile}
      gym={gym}
      metrics={{ activeCount, expiringCount, totalRevenue }}
      members={members}
    />
  )
}
