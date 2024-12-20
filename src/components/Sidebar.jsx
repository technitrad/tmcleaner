import { useState } from 'react'
import clsx from 'clsx'
import { FiHome, FiGrid, FiMessageSquare, FiUsers, FiCheckSquare, FiFileText, FiSettings } from 'react-icons/fi'

const menuItems = [
  { id: 'dashboard', icon: FiHome, label: 'Dashboard' },
  { id: 'overview', icon: FiGrid, label: 'Overview' },
  { id: 'chat', icon: FiMessageSquare, label: 'Chat', notifications: 6 },
  { id: 'team', icon: FiUsers, label: 'Team' },
  { id: 'tasks', icon: FiCheckSquare, label: 'Tasks' },
  { id: 'reports', icon: FiFileText, label: 'Reports' },
  { id: 'settings', icon: FiSettings, label: 'Settings' }
]

function Sidebar({ showSidebar, onSidebarHide }) {
  const [selectedItem, setSelectedItem] = useState('dashboard')

  return (
    <div className={clsx(
      'fixed inset-y-0 left-0 bg-[#171717] w-64 transition-all duration-300 ease-in-out transform',
      showSidebar ? 'translate-x-0' : '-translate-x-full'
    )}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="h-16 flex items-center px-4 border-b border-[#2e2e2e]">
          <h1 className="text-white text-xl font-bold">Dashboard</h1>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-4">
          {menuItems.map(({ id, icon: Icon, label, notifications }) => (
            <div
              key={id}
              className={clsx(
                'sidebar-item mb-2',
                selectedItem === id && 'sidebar-item-selected'
              )}
              onClick={() => setSelectedItem(id)}
            >
              <Icon className="w-5 h-5" />
              <span className="ml-3">{label}</span>
              {notifications && (
                <span className="ml-auto bg-pink-600 text-white text-xs px-2 py-1 rounded-full">
                  {notifications}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* User Profile */}
        <div className="h-16 flex items-center px-4 border-t border-[#2e2e2e]">
          <div className="w-8 h-8 rounded-full bg-[#2d2d2d]" />
          <div className="ml-3">
            <p className="text-white text-sm font-semibold">John Doe</p>
            <p className="text-xs">Admin</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar