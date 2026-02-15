import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import AdminSidebar from './components/AdminSidebar'

export default function AdminLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="flex min-h-screen bg-slate-100">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar - hidden on mobile by default */}
            <div className={`
                fixed inset-y-0 left-0 z-50 md:relative md:z-auto
                transform transition-transform duration-300 md:transform-none
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <AdminSidebar
                    collapsed={sidebarCollapsed}
                    onCollapse={setSidebarCollapsed}
                    onCloseMobile={() => setSidebarOpen(false)}
                />
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto min-w-0">
                {/* Mobile header with hamburger */}
                <div className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-slate-800">Admin</span>
                </div>

                <div className="p-4 sm:p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
