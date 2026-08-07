import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { repAPI, isAuthenticated, clearToken } from '../../lib/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function ClassDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [classInfo, setClassInfo] = useState(null)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
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

    // Safely invoke autoTable across bundlers
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

  function handleDownloadCSV() {
    const token = localStorage.getItem('rep_token')
    const apiBase = import.meta.env.VITE_API_URL || '/api'
    fetch(`${apiBase}/rep/classes/${id}/export`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${classInfo?.class_name || 'roster'}_export.csv`
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  const filtered = getFiltered()

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-brand">
          <div className="brand-icon">A</div>
          <div>
            <div className="brand-name">{classInfo?.class_name || 'Loading...'}</div>
            <div className="brand-sub">Code: <strong>{classInfo?.class_code || '...'}</strong></div>
          </div>
        </div>
        <div className="header-actions">
          <span className="badge">{groups.length} group{groups.length === 1 ? '' : 's'}</span>
          <Link to="/admin" className="btn btn-secondary btn-sm">← All Classes</Link>
        </div>
      </header>

      <main>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="toolbar">
          <div className="toolbar-left">
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
                      <span className="group-badge">Group #{g.group_number}</span>
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
      </main>

      <footer className="page-footer">
        <p>Group Number Allocation System</p>
      </footer>
    </div>
  )
}
