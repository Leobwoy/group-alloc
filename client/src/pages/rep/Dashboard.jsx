import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { repAPI, isAuthenticated, clearToken } from '../../lib/api'

export default function Dashboard() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [copiedCode, setCopiedCode] = useState(null)

  const repName = localStorage.getItem('rep_name') || 'Course Rep'

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/admin/login')
      return
    }
    loadClasses()
  }, [])

  async function loadClasses() {
    try {
      const data = await repAPI.getClasses()
      setClasses(data.classes)
    } catch (err) {
      if (err.message.includes('401') || err.message.includes('Authentication')) {
        clearToken()
        navigate('/admin/login')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newClassName.trim()) return
    setCreating(true)
    setError('')

    try {
      await repAPI.createClass({ class_name: newClassName.trim() })
      setNewClassName('')
      setShowForm(false)
      await loadClasses()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function handleLogout() {
    clearToken()
    localStorage.removeItem('rep_name')
    navigate('/admin/login')
  }

  function copyLink(classCode) {
    const url = `${window.location.origin}/submit/${classCode}`
    navigator.clipboard.writeText(url)
    setCopiedCode(classCode)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-brand">
          <div className="brand-icon">A</div>
          <div>
            <div className="brand-name">GroupAlloc</div>
            <div className="brand-sub">Welcome, {repName}</div>
          </div>
        </div>
        <div className="header-actions">
          <span className="badge badge-admin">Admin</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Log Out</button>
        </div>
      </header>

      <main>
        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.2rem, 3.5vw, 1.35rem)', fontWeight: 700 }}>
            Your Classes
          </h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Class'}
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ padding: 'clamp(1rem, 3vw, 1.25rem)' }}>
            <form onSubmit={handleCreate} className="create-class-form">
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">Class Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CS401 Software Engineering"
                  required
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={creating} style={{ flexShrink: 0 }}>
                {creating ? 'Creating...' : 'Create Class'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="empty-state"><p>Loading classes...</p></div>
        ) : classes.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <h4>No classes yet</h4>
              <p>Create your first class to get a shareable submission link.</p>
            </div>
          </div>
        ) : (
          classes.map(c => (
            <div key={c.id} className="class-card-wrapper">
              <Link to={`/admin/classes/${c.id}`} className="class-card">
                <div className="class-card-info">
                  <h3>{c.class_name}</h3>
                  <p>Code: <strong>{c.class_code}</strong></p>
                </div>
                <div className="class-card-meta">
                  <span className="count">{c.group_count}</span>
                  group{c.group_count == 1 ? '' : 's'}
                </div>
              </Link>
              <div className="share-box">
                <input
                  className="share-input"
                  readOnly
                  value={`${window.location.origin}/submit/${c.class_code}`}
                  aria-label="Submission URL"
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyLink(c.class_code)}
                  style={{ minWidth: '90px' }}
                >
                  {copiedCode === c.class_code ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      <footer className="page-footer">
        <p>Group Number Allocation System</p>
      </footer>
    </div>
  )
}
