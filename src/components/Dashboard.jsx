import { FiSearch, FiBell, FiStar, FiMenu } from 'react-icons/fi'
import StatCard from './StatCard'
import RecentActivity from './RecentActivity'

function Dashboard({ onSidebarShow }) {
  return (
    <div className="flex-1 ml-64">
      {/* Header */}
      <header className="h-16 bg-[#171717] flex items-center justify-between px-6">
        <button
          onClick={onSidebarShow}
          className="lg:hidden text-white"
        >
          <FiMenu className="w-6 h-6" />
        </button>

        <div className="flex items-center flex-1 max-w-xl ml-4">
          <div className="relative w-full">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-[#2d2d2d] text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center">
          <button className="p-2 text-gray-400 hover:text-white">
            <FiBell className="w-6 h-6" />
          </button>
          <button className="p-2 text-gray-400 hover:text-white ml-2">
            <FiStar className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            title="Total Revenue"
            value="$24,560"
            change="+2.5%"
            isPositive={true}
          />
          <StatCard
            title="Active Users"
            value="1,234"
            change="-0.8%"
            isPositive={false}
          />
          <StatCard
            title="Conversion Rate"
            value="2.4%"
            change="+1.2%"
            isPositive={true}
          />
        </div>

        <div className="mt-6">
          <RecentActivity />
        </div>
      </main>
    </div>
  )
}

export default Dashboard