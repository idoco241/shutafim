import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/auth'
import type { Sex } from '../types'

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'm', label: 'Male' },
  { value: 'f', label: 'Female' },
  { value: 'other', label: 'Other' },
]

export default function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<Sex | ''>('')
  const [fieldOfStudy, setFieldOfStudy] = useState('')
  const [yearOfStudy, setYearOfStudy] = useState('')

  useEffect(() => {
    if (!user) return
    supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name ?? '')
          setAge(data.age?.toString() ?? '')
          setSex(data.sex ?? '')
          setFieldOfStudy(data.field_of_study ?? '')
          setYearOfStudy(data.year_of_study?.toString() ?? '')
        }
        setPageLoading(false)
      })
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !name.trim()) return
    setSaving(true)
    setError('')

    const { error } = await supabase.from('users').upsert({
      id: user.id,
      name: name.trim(),
      age: age ? parseInt(age) : null,
      sex: sex || null,
      field_of_study: fieldOfStudy.trim() || null,
      year_of_study: yearOfStudy ? parseInt(yearOfStudy) : null,
    })

    setSaving(false)
    if (error) {
      setError(error.message)
    } else {
      navigate('/rooms')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 rounded-full border-2 border-purple-700 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-gray-900 mb-6">My profile</h1>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min={17}
            max={40}
            placeholder="e.g. 22"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
          <div className="flex gap-2">
            {SEX_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSex((prev) => (prev === opt.value ? '' : opt.value))}
                className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${
                  sex === opt.value
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'border-gray-200 text-gray-600 hover:border-purple-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Field of study</label>
          <input
            type="text"
            value={fieldOfStudy}
            onChange={(e) => setFieldOfStudy(e.target.value)}
            placeholder="e.g. Computer Science"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year of study</label>
          <select
            value={yearOfStudy}
            onChange={(e) => setYearOfStudy(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          >
            <option value="">Select year</option>
            {[1, 2, 3, 4, 5, 6].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full py-3 bg-purple-700 text-white text-sm font-medium rounded-xl hover:bg-purple-800 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <button
        onClick={handleSignOut}
        className="w-full mt-6 py-3 text-sm text-gray-400 hover:text-red-500 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}
