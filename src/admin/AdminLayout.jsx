import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import AdminSidebar from './components/AdminSidebar'

export default function AdminLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    return (
        <div className="flex h-screen bg-slate-100">
            {/* Sidebar */}
            <AdminSidebar
                collapsed={sidebarCollapsed}
                onCollapse={setSidebarCollapsed}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
