'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Member = {
  id: string
  name: string
  phone: string
  expiry: string
  status: 'active' | 'expired'
  plan: number
  paid: number
}

type Props = {
  user: any
  profile: any
  gym: any
  metrics: {
    activeCount: number
    expiringCount: number
    totalRevenue: number
  }
  members: Member[]
}

export default function DashboardClient({ user, profile, gym, metrics, members: initialMembers }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'members'>('dashboard')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showWaModal, setShowWaModal] = useState(false)
  const [waMember, setWaMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(false)

  // Add member form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [plan, setPlan] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const planPrices: Record<string, number> = { '1': 2000, '3': 5000, '12': 15000 }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function calcExpiry(months: number) {
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    return d.toISOString().split('T')[0]
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!gym || !plan) return
    setLoading(true)

    try {
      const months = parseInt(plan)
      const price = planPrices[plan]
      const expiry = calcExpiry(months)

      // Insert member
      const { data: member, error: memberErr } = await supabase
        .from('members')
        .insert({
          gym_id: gym.id,
          full_name: name,
          phone_number: phone,
        })
        .select()
        .single()

      if (memberErr) throw memberErr

      // Insert membership
      const { data: membership, error: memErr } = await supabase
        .from('memberships')
        .insert({
          member_id: member.id,
          gym_id: gym.id,
          plan_duration_months: months,
          start_date: new Date().toISOString().split('T')[0],
          expiry_date: expiry,
          status: 'active',
          total_paid: price,
        })
        .select()
        .single()

      if (memErr) throw memErr

      // Update local state
      setMembers(prev => [{
        id: membership.id,
        name,
        phone,
        expiry,
        status: 'active',
        plan: months,
        paid: price,
      }, ...prev])

      setShowAddModal(false)
      setName('')
      setPhone('')
      setPlan('')
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  function openWhatsApp(member: Member) {
    setWaMember(member)
    setShowWaModal(true)
  }

  function getWaMessage(m: Member) {
    const days = Math.ceil((new Date(m.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const statusText = m.status === 'active'
      ? (days <= 7 ? `expiring in ${days} day${days !== 1 ? 's' : ''}` : 'active')
      : 'expired'

    return `Hi ${m.name}! 👋

This is a friendly reminder from *${gym?.name || 'FitFlow Gym'}*.

Your ${m.plan}-month membership is currently *${statusText}*.
📅 Expiry Date: ${formatDate(m.expiry)}
💰 Renewal Amount: ₹${planPrices[String(m.plan)]?.toLocaleString('en-IN') || m.paid}

Please renew to continue enjoying uninterrupted access.

Pay via UPI / Cash at the front desk.
Reply YES to confirm or call us for assistance.

Thank you!
— ${gym?.name || 'FitFlow'} Team`
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b px-5 py-3 flex items-center justify-between gap-4 flex-wrap"
              style={{ background: 'rgba(11,15,20,0.9)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base neon-glow"
               style={{ background: 'linear-gradient(135deg, #39ff14, #00cc66)' }}>
            💪
          </div>
          <div>
            <div className="font-bold text-base">Fit<span className="neon-text">Flow</span></div>
            {gym && (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {gym.name} · {gym.unique_id}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === 'dashboard' ? 'neon-text' : ''}`}
            style={activeTab === 'dashboard' ? { background: 'var(--neon-dim)' } : { color: 'var(--text-secondary)' }}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === 'members' ? 'neon-text' : ''}`}
            style={activeTab === 'members' ? { background: 'var(--neon-dim)' } : { color: 'var(--text-secondary)' }}
          >
            Members
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="text-sm px-3 py-1.5 rounded-lg border transition"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Logout
        </button>
      </header>

      <main className="flex-1 p-5 max-w-5xl mx-auto w-full pb-24">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <>
            <h1 className="text-xl font-bold mb-1">Dashboard</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Overview of your gym performance
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="card p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, var(--neon), transparent)' }} />
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>👥 Total Active Members</div>
                <div className="text-3xl font-bold neon-text">{metrics.activeCount}</div>
              </div>
              <div className="card p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, var(--neon), transparent)' }} />
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>💰 Monthly Revenue</div>
                <div className="text-3xl font-bold neon-text">₹{metrics.totalRevenue.toLocaleString('en-IN')}</div>
              </div>
              <div className="card p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, var(--warning), transparent)' }} />
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>⚠️ Expiring in 7 Days</div>
                <div className="text-3xl font-bold" style={{ color: 'var(--warning)' }}>{metrics.expiringCount}</div>
              </div>
            </div>

            {!gym && (
              <div className="card p-6 text-center">
                <p style={{ color: 'var(--text-secondary)' }}>
                  No gym found. Sign up as a new gym owner to auto-create one, or contact support.
                </p>
              </div>
            )}
          </>
        )}

        {/* MEMBERS TAB */}
        {activeTab === 'members' && (
          <>
            <h1 className="text-xl font-bold mb-1">Members</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Manage memberships & send renewal alerts
            </p>

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                <h3 className="font-semibold text-sm">All Members</h3>
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Phone</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Expiry</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                          No members yet. Click + to add one.
                        </td>
                      </tr>
                    ) : (
                      members.map((m) => (
                        <tr key={m.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                          <td className="px-4 py-3 font-medium">{m.name}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{m.phone}</td>
                          <td className="px-4 py-3">{formatDate(m.expiry)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.status === 'active' ? 'badge-active' : 'badge-expired'}`}>
                              {m.status === 'active' ? 'Active' : 'Expired'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => openWhatsApp(m)}
                              className="text-xs px-3 py-1.5 rounded-lg border transition"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                            >
                              Send Renewal Alert
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-2xl font-light flex items-center justify-center neon-glow transition hover:scale-105 active:scale-95"
        style={{ background: 'var(--neon)', color: '#0a0f0a' }}
        title="Add New Member"
      >
        +
      </button>

      {/* ADD MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
             style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
             onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md card p-6 rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold">Add New Member</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>×</button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)}
                       className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                       style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                       placeholder="e.g. Rahul Sharma" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Phone Number</label>
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} pattern="[0-9]{10}" maxLength={10}
                       className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                       style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                       placeholder="9876543210" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Membership Plan</label>
                <select required value={plan} onChange={(e) => setPlan(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <option value="">Select a plan</option>
                  <option value="1">1 Month — ₹2,000</option>
                  <option value="3">3 Months — ₹5,000</option>
                  <option value="12">12 Months — ₹15,000</option>
                </select>
              </div>

              {plan && (
                <div className="flex justify-between items-center px-3 py-2.5 rounded-lg text-sm"
                     style={{ background: 'var(--neon-dim)', border: '1px solid rgba(57,255,20,0.25)' }}>
                  <span>Expiry Date</span>
                  <span className="font-semibold neon-text">{formatDate(calcExpiry(parseInt(plan)))}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                        className="flex-1 py-2.5 rounded-lg text-sm border"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                        className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                        style={{ background: 'var(--neon)', color: '#0a0f0a' }}>
                  {loading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHATSAPP MODAL */}
      {showWaModal && waMember && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
             style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
             onClick={() => setShowWaModal(false)}>
          <div className="w-full max-w-md card p-6 rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Send Renewal Alert</h2>
              <button onClick={() => setShowWaModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>×</button>
            </div>

            <div className="rounded-xl p-4 mb-4" style={{ background: '#0b141a', border: '1px solid #1f2c34' }}>
              <div className="flex items-center gap-3 mb-3 pb-3" style={{ borderBottom: '1px solid #1f2c34' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                     style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)' }}>💬</div>
                <div>
                  <div className="font-semibold text-sm">{waMember.name}</div>
                  <div className="text-xs" style={{ color: '#8696a0' }}>WhatsApp · Simulated</div>
                </div>
              </div>
              <div className="rounded-lg p-3 text-sm whitespace-pre-wrap leading-relaxed"
                   style={{ background: '#005c4b', color: '#e9edef' }}>
                {getWaMessage(waMember)}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowWaModal(false)}
                      className="flex-1 py-2.5 rounded-lg text-sm border"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getWaMessage(waMember))
                  alert('Message copied!')
                }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--neon)', color: '#0a0f0a' }}
              >
                Copy Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
