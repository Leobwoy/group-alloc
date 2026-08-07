import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { repAPI, isAuthenticated, clearToken } from '../../lib/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { WhatsAppIcon, TrashIcon, LockIcon, UnlockIcon, CopyIcon, CheckIcon, EditIcon } from '../../components/Icons'

export default function ClassDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [classInfo, setClassInfo] = useState(null)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editingClass, setEditingClass] = useState(false)
  const [editName, setEditName] = useState('')
  const [editMax, setEditMax] = useState('')
  const [groupToDelete, setGroupToDelete] = useState(null)
  const [classToDelete, setClassToDelete] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/admin/login')
      return
    }

    loadData()

    // Poll every 4 seconds
    pollRef.current = setInterval(loadData, 4000)
    return () => clearInterval(pollRef.current)
  }, [id])

  async function loadData() {
    try {
      const data = await repAPI.getClassGroups(id)
      setClassInfo(data.class)
      setGroups(data.groups)
      setError('')
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

  async function handleToggleLock() {
    if (!classInfo) return
    try {
      await repAPI.updateClass(id, { is_locked: !classInfo.is_locked })
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  function startEditing() {
    setEditName(classInfo?.class_name || '')
    setEditMax(classInfo?.max_groups ? String(classInfo.max_groups) : '')
    setEditingClass(true)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editName.trim()) return
    setActionLoading(true)
    try {
      await repAPI.updateClass(id, {
        class_name: editName.trim(),
        max_groups: editMax ? parseInt(editMax, 10) : null
      })
      setEditingClass(false)
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function confirmDeleteGroup() {
    if (!groupToDelete) return
    setActionLoading(true)
    try {
      await repAPI.deleteGroup(id, groupToDelete.id)
      setGroupToDelete(null)
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function confirmDeleteClass() {
    setActionLoading(true)
    try {
      await repAPI.deleteClass(id)
      navigate('/admin')
    } catch (err) {
      setError(err.message)
      setActionLoading(false)
      setClassToDelete(false)
    }
  }

  function copySubmissionLink() {
    if (!classInfo) return
    const url = `${window.location.origin}/submit/${classInfo.class_code}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareWhatsApp() {
    if (!classInfo) return
    const url = `${window.location.origin}/submit/${classInfo.class_code}`
    const text = `Register your presentation group for *${classInfo.class_name}* here:\n${url}`
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
  }

  function getFiltered() {
    if (!search.trim()) return groups
    const q = search.toLowerCase()
    return groups.filter(g =>
      g.leader_name.toLowerCase().includes(q) ||
      g.group_name.toLowerCase().includes(q) ||
      `group ${g.group_number}`.includes(q) ||
      `#${g.group_number}`.includes(q)
    )
  }

  function handleDownloadPDF() {
    if (groups.length === 0) return

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 40

    // Header
    doc.setFillColor(79, 70, 229)
    doc.rect(0, 0, pageWidth, 75, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(255, 255, 255)
    doc.text('PRESENTATION GROUP ROSTER', margin, 40)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(224, 231, 255)
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    doc.text(`${classInfo?.class_name || 'Class'}  |  Generated: ${dateStr}  |  Total: ${groups.length} groups`, margin, 58)

    // Table
    const sorted = [...groups].sort((a, b) => a.group_number - b.group_number)
    const rows = sorted.map((g, i) => [
      `${i + 1}`,
      `Group ${g.group_number}`,
      g.group_name,
      g.leader_name,
      new Date(g.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    ])

    const tableFn = typeof autoTable === 'function' ? autoTable : (autoTable?.default || (typeof doc.autoTable === 'function' ? doc.autoTable.bind(doc) : null));
    if (tableFn) {
      tableFn(doc, {
        startY: 95,
        margin: { left: margin, right: margin },
        head: [['Order', 'Group #', 'Group Name', 'Leader Name', 'Time']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [67, 56, 202], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: 7 },
        bodyStyles: { fontSize: 9, textColor: [15, 23, 42], cellPadding: 6, lineColor: [226, 232, 240] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold', halign: 'center', textColor: [79, 70, 229] },
          1: { cellWidth: 80, fontStyle: 'bold', halign: 'center' },
          2: { cellWidth: 160, fontStyle: 'bold' },
          3: { cellWidth: 130 },
          4: { cellWidth: 'auto', halign: 'center', textColor: [100, 116, 139] }
        }
      })
    }

    const name = (classInfo?.class_name || 'Roster').replace(/[^a-z0-9]/gi, '_')
    doc.save(`${name}_Roster_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  function handleDownloadExcel() {
    if (groups.length === 0) return

    const sorted = [...groups].sort((a, b) => a.group_number - b.group_number)
    const data = [
      ['Order', 'Group Number', 'Group Name', 'Leader Name', 'Submission Time'],
      ...sorted.map((g, i) => [
        i + 1,
        `Group ${g.group_number}`,
        g.group_name,
        g.leader_name,
        new Date(g.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      ])
    ]

    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [
      { wch: 10 },
      { wch: 15 },
      { wch: 28 },
      { wch: 24 },
      { wch: 18 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Presentation Roster')

    const safeName = (classInfo?.class_name || 'Roster').replace(/[^a-z0-9]/gi, '_')
    const dateStr = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `${safeName}_Roster_${dateStr}.xlsx`)
  }

  function handleDownloadCSV() {
    if (groups.length === 0) return
    const sorted = [...groups].sort((a, b) => a.group_number - b.group_number)
    const headers = ['Order', 'Group Number', 'Group Name', 'Leader Name', 'Submission Time']
    const rows = sorted.map((g, i) => [
      i + 1,
      `"Group ${g.group_number}"`,
      `"${(g.group_name || '').replace(/"/g, '""')}"`,
      `"${(g.leader_name || '').replace(/"/g, '""')}"`,
      `"${new Date(g.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}"`
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = (classInfo?.class_name || 'Roster').replace(/[^a-z0-9]/gi, '_')
    a.download = `${safeName}_Roster_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filtered = getFiltered()

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-brand">
          <div className="brand-icon">A</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div className="brand-name">{classInfo?.class_name || 'Loading...'}</div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={startEditing}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', minHeight: '26px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                title="Edit class name or max limit"
              >
                <EditIcon size={12} /> Edit
              </button>
            </div>
            <div className="brand-sub" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>Code: <strong>{classInfo?.class_code || '...'}</strong></span>
              {classInfo?.is_locked ? (
                <span className="badge badge-warning" style={{ fontSize: '0.75rem', gap: '0.25rem' }}>
                  <LockIcon size={12} /> Closed
                </span>
              ) : (
                <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                  <span className="status-dot"></span> Open
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="header-actions">
          <span className="badge">
            {groups.length} {classInfo?.max_groups ? `/ ${classInfo.max_groups} ` : ''}group{groups.length === 1 ? '' : 's'}
          </span>
          <Link to="/admin" className="btn btn-secondary btn-sm">← All Classes</Link>
        </div>
      </header>

      <main>
        {error && <div className="alert alert-error">{error}</div>}

        {/* Quick Share and Control Bar */}
        <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={copySubmissionLink}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              {copied ? 'Link Copied' : 'Copy Link'}
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={shareWhatsApp}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <WhatsAppIcon size={14} /> WhatsApp Share
            </button>
            <button
              className={`btn btn-sm ${classInfo?.is_locked ? 'btn-secondary' : 'btn-warning'}`}
              onClick={handleToggleLock}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {classInfo?.is_locked ? (
                <>
                  <UnlockIcon size={14} /> Open Submissions
                </>
              ) : (
                <>
                  <LockIcon size={14} /> Lock Submissions
                </>
              )}
            </button>
          </div>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => setClassToDelete(true)}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <TrashIcon size={14} /> Delete Class
          </button>
        </div>

        <div className="toolbar">
          <div className="toolbar-left">
            <button className="btn btn-success btn-sm" onClick={handleDownloadExcel} disabled={groups.length === 0}>
              Download Excel (.xlsx)
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleDownloadPDF} disabled={groups.length === 0}>
              Download PDF
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleDownloadCSV} disabled={groups.length === 0}>
              Download CSV
            </button>
          </div>
          <div className="toolbar-right">
            <input
              type="text"
              className="search-input"
              placeholder="Search group or leader..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="card" style={{ padding: 'clamp(1rem, 3vw, 1.5rem)' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
            Presentation Order
          </h3>

          {loading ? (
            <div className="empty-state"><p>Loading submissions...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <h4>{search ? 'No matching groups' : 'No groups registered yet'}</h4>
              <p>{search ? 'Try a different search.' : 'Group leaders will appear here as they submit.'}</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="table-wrap desktop-only">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>Order</th>
                      <th style={{ width: '110px' }}>Group #</th>
                      <th>Group Name</th>
                      <th>Leader Name</th>
                      <th style={{ width: '100px' }}>Time</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((g, i) => (
                      <tr key={g.id}>
                        <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>#{i + 1}</td>
                        <td><span className="group-badge">Group #{g.group_number}</span></td>
                        <td style={{ fontWeight: 600 }}>{g.group_name}</td>
                        <td>{g.leader_name}</td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                          {new Date(g.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setGroupToDelete(g)}
                            style={{ padding: '0.25rem 0.5rem', minHeight: '28px' }}
                            title="Remove group"
                            aria-label="Remove group"
                          >
                            <TrashIcon size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="mobile-order-list">
                {filtered.map((g, i) => (
                  <div key={g.id} className="mobile-order-card">
                    <div className="mobile-order-card-header">
                      <span className="mobile-order-num">Order #{i + 1}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="group-badge">Group #{g.group_number}</span>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setGroupToDelete(g)}
                          style={{ padding: '0.25rem 0.45rem', minHeight: '26px' }}
                          title="Remove group"
                          aria-label="Remove group"
                        >
                          <TrashIcon size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="mobile-order-card-body">
                      <div className="mobile-group-title">{g.group_name}</div>
                      <div className="mobile-leader-info">
                        <span>Leader:</span>
                        <strong>{g.leader_name}</strong>
                      </div>
                      <div className="mobile-time-stamp">
                        Submitted: {new Date(g.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Edit Class Modal */}
        {editingClass && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <h3 style={{ marginBottom: '1rem' }}>Edit Class Settings</h3>
              <form onSubmit={handleSaveEdit}>
                <div className="form-group">
                  <label className="form-label">Class Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Groups (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    placeholder="e.g. 15 (leave blank for unlimited)"
                    value={editMax}
                    onChange={e => setEditMax(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditingClass(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Group Modal */}
        {groupToDelete && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <h3 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Remove Group Submission</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Are you sure you want to remove <strong>Group #{groupToDelete.group_number} ({groupToDelete.group_name})</strong>?
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setGroupToDelete(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={confirmDeleteGroup}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Removing...' : 'Remove Group'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Class Modal */}
        {classToDelete && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <h3 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Delete Entire Class</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Are you sure you want to delete <strong>{classInfo?.class_name}</strong>? This action is permanent and will remove all {groups.length} group submissions.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setClassToDelete(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={confirmDeleteClass}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Deleting...' : 'Delete Class'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="page-footer">
        <p>Group Number Allocation System</p>
      </footer>
    </div>
  )
}
