import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { submitAPI } from '../../lib/api'

export default function SubmitPage() {
  const { classCode } = useParams()
  const [className, setClassName] = useState('')
  const [validating, setValidating] = useState(true)
  const [invalid, setInvalid] = useState(false)

  const [form, setForm] = useState({ leader_name: '', group_name: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [result, setResult] = useState(null) // { group_number, leader_name, group_name, submitted_at }

  useEffect(() => {
    validateCode()
  }, [classCode])

  async function validateCode() {
    try {
      const data = await submitAPI.validateCode(classCode)
      setClassName(data.class.class_name)
    } catch {
      setInvalid(true)
    } finally {
      setValidating(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const data = await submitAPI.submit(classCode, {
        leader_name: form.leader_name.trim(),
        group_name: form.group_name.trim()
      })
      setResult(data.group)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Invalid class code
  if (!validating && invalid) {
    return (
      <div className="page-container page-narrow">
        <header className="page-header">
          <div className="header-brand">
            <div className="brand-icon">#</div>
            <div>
              <div className="brand-name">GroupAlloc</div>
              <div className="brand-sub">Group Submission</div>
            </div>
          </div>
        </header>
        <main>
          <div className="card" style={{ textAlign: 'center' }}>
            <h2 className="card-title">Invalid Link</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              This class code does not exist. Please check the link your course rep shared.
            </p>
          </div>
        </main>
      </div>
    )
  }

  // Loading
  if (validating) {
    return (
      <div className="page-container page-narrow">
        <div className="empty-state" style={{ paddingTop: '6rem' }}>
          <p>Validating class code...</p>
        </div>
      </div>
    )
  }

  // Already submitted — show assigned number
  if (result) {
    return (
      <div className="page-container page-narrow">
        <header className="page-header">
          <div className="header-brand">
            <div className="brand-icon">#</div>
            <div>
              <div className="brand-name">GroupAlloc</div>
              <div className="brand-sub">{className}</div>
            </div>
          </div>
        </header>
        <main>
          <div className="card assigned-card">
            <div className="assigned-icon">✓</div>
            <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>Your Group Number</h2>
            <div className="assigned-number">Group #{result.group_number}</div>

            <div className="assigned-details">
              <div className="detail-row">
                <span className="detail-label">Leader Name</span>
                <span className="detail-value">{result.leader_name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Group Name</span>
                <span className="detail-value">{result.group_name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Submitted At</span>
                <span className="detail-value">
                  {new Date(result.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </main>
        <footer className="page-footer">
          <p>Group Number Allocation System</p>
        </footer>
      </div>
    )
  }

  // Submission form
  return (
    <div className="page-container page-narrow">
      <header className="page-header">
        <div className="header-brand">
          <div className="brand-icon">#</div>
          <div>
            <div className="brand-name">GroupAlloc</div>
            <div className="brand-sub">{className}</div>
          </div>
        </div>
        <span className="badge">Group Submission</span>
      </header>

      <main>
        <div className="card">
          <h2 className="card-title">Generate Group Number</h2>
          <p className="card-subtitle">
            Enter your details to receive your group's presentation number.
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Leader Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. John Doe"
                required
                maxLength={255}
                autoCapitalize="words"
                autoComplete="name"
                enterKeyHint="next"
                value={form.leader_name}
                onChange={e => setForm({ ...form, leader_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Group Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Alpha Team"
                required
                maxLength={255}
                autoCapitalize="words"
                enterKeyHint="done"
                value={form.group_name}
                onChange={e => setForm({ ...form, group_name: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Generating...' : 'Generate Group Number'}
            </button>
          </form>
        </div>
      </main>

      <footer className="page-footer">
        <p>Group Number Allocation System</p>
      </footer>
    </div>
  )
}
