import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { repAPI, setToken } from '../../lib/api'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await repAPI.register(form)
      setToken(data.token)
      localStorage.setItem('rep_name', data.rep.full_name)
      navigate('/admin')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container page-narrow">
      <header className="page-header">
        <div className="header-brand">
          <div className="brand-icon">#</div>
          <div>
            <div className="brand-name">GroupAlloc</div>
            <div className="brand-sub">Course Rep Registration</div>
          </div>
        </div>
      </header>

      <main>
        <div className="card">
          <h2 className="card-title">Create Account</h2>
          <p className="card-subtitle">Register as a course representative to start creating classes.</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Kwame Mensah"
                required
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@university.edu"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Already have an account? <Link to="/admin/login" className="btn-link">Sign In</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
