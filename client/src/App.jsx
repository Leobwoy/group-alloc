import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/rep/Login'
import Register from './pages/rep/Register'
import Dashboard from './pages/rep/Dashboard'
import ClassDetail from './pages/rep/ClassDetail'
import SubmitPage from './pages/submit/SubmitPage'

export default function App() {
  return (
    <Routes>
      {/* Course Rep Portal */}
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin/register" element={<Register />} />
      <Route path="/admin" element={<Dashboard />} />
      <Route path="/admin/classes/:id" element={<ClassDetail />} />

      {/* Group Leader Portal — completely separate, no shared nav */}
      <Route path="/submit/:classCode" element={<SubmitPage />} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  )
}
