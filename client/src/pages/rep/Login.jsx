import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { repAPI, setToken } from '../../lib/api'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await repAPI.login(form)
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
            <div className="brand-sub">Course Rep Login</div>
          </div>
        </div>
      </header>

      <main>
        <div className="card">
          <h2 className="card-title">Sign In</h2>
          <p className="card-subtitle">Log in to manage your classes and view submissions.</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
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
                placeholder="••••••••"
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Don't have an account? <Link to="/admin/register" className="btn-link">Register</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
