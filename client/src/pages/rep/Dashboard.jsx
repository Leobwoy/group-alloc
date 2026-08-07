import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { repAPI, isAuthenticated, clearToken } from '../../lib/api'
import { WhatsAppIcon, TrashIcon, LockIcon, UnlockIcon, CopyIcon, CheckIcon } from '../../components/Icons'

export default function Dashboard() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newMaxGroups, setNewMaxGroups] = useState('')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [copiedCode, setCopiedCode] = useState(null)
  const [classToDelete, setClassToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

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
      await repAPI.createClass({
        class_name: newClassName.trim(),
        max_groups: newMaxGroups ? parseInt(newMaxGroups, 10) : null
      })
      setNewClassName('')
      setNewMaxGroups('')
      setShowForm(false)
      await loadClasses()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleLock(classItem, e) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await repAPI.updateClass(classItem.id, { is_locked: !classItem.is_locked })
      await loadClasses()
    } catch (err) {
      setError(err.message)
    }
  }

  async function confirmDeleteClass() {
    if (!classToDelete) return
    setDeleting(true)
    try {
      await repAPI.deleteClass(classToDelete.id)
      setClassToDelete(null)
      await loadClasses()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
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

  function shareWhatsApp(classItem) {
    const url = `${window.location.origin}/submit/${classItem.class_code}`
    const text = `Register your presentation group for *${classItem.class_name}* here:\n${url}`
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
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
          <div className="card" style={{ padding: 'clamp(1rem, 3vw, 1.25rem)', marginBottom: '1.5rem' }}>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Class Name *</label>
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
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Max Groups (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    placeholder="e.g. 15 (leave blank for unlimited)"
                    value={newMaxGroups}
                    onChange={e => setNewMaxGroups(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Class'}
                </button>
              </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <h3 style={{ margin: 0 }}>{c.class_name}</h3>
                    {c.is_locked ? (
                      <span className="badge badge-warning" style={{ fontSize: '0.75rem', gap: '0.25rem' }}>
                        <LockIcon size={12} /> Closed
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                        <span className="status-dot"></span> Open
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0 }}>Code: <strong>{c.class_code}</strong></p>
                </div>
                <div className="class-card-meta">
                  <span className="count">{c.group_count}</span>
                  {c.max_groups ? ` / ${c.max_groups} groups` : ` group${c.group_count == 1 ? '' : 's'}`}
                </div>
              </Link>
              <div className="share-box" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  className="share-input"
                  readOnly
                  value={`${window.location.origin}/submit/${c.class_code}`}
                  aria-label="Submission URL"
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyLink(c.class_code)}
                  style={{ minWidth: '90px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {copiedCode === c.class_code ? (
                    <>
                      <CheckIcon size={14} /> Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon size={14} /> Copy Link
                    </>
                  )}
                </button>
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => shareWhatsApp(c)}
                  style={{ minWidth: '100px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <WhatsAppIcon size={14} /> WhatsApp
                </button>
                <button
                  className={`btn btn-sm ${c.is_locked ? 'btn-secondary' : 'btn-warning'}`}
                  onClick={(e) => handleToggleLock(c, e)}
                  title={c.is_locked ? 'Unlock submissions' : 'Lock submissions'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {c.is_locked ? (
                    <>
                      <UnlockIcon size={14} /> Unlock
                    </>
                  ) : (
                    <>
                      <LockIcon size={14} /> Lock
                    </>
                  )}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setClassToDelete(c)}
                  title="Delete this class"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <TrashIcon size={14} /> Delete
                </button>
              </div>
            </div>
          ))
        )}

        {/* Delete Confirmation Modal */}
        {classToDelete && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <h3 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Delete Class</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Are you sure you want to delete <strong>{classToDelete.class_name}</strong>? This will permanently delete the class and all associated group submissions.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setClassToDelete(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={confirmDeleteClass}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete Class'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="page-footer">
        <p>Group Number Allocation System • Rep Dashboard</p>
      </footer>
    </div>
  )
}
