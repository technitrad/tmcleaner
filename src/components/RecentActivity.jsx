import { FiClock } from 'react-icons/fi'

const activities = [
  {
    id: 1,
    user: 'John Doe',
    action: 'completed task',
    target: 'Website Redesign',
    time: '2 hours ago'
  },
  {
    id: 2,
    user: 'Jane Smith',
    action: 'commented on',
    target: 'Project Timeline',
    time: '4 hours ago'
  },
  {
    id: 3,
    user: 'Mike Johnson',
    action: 'created new task',
    target: 'User Authentication',
    time: '6 hours ago'
  }
]

function RecentActivity() {
  return (
    <div className="bg-[#171717] rounded-lg p-6">
      <h2 className="text-white text-lg font-semibold mb-4">Recent Activity</h2>
      <div className="space-y-4">
        {activities.map(({ id, user, action, target, time }) => (
          <div key={id} className="flex items-start">
            <div className="w-8 h-8 rounded-full bg-[#2d2d2d] flex items-center justify-center">
              <FiClock className="text-gray-400" />
            </div>
            <div className="ml-3">
              <p className="text-gray-300">
                <span className="font-semibold">{user}</span>
                {' '}{action}{' '}
                <span className="text-blue-400">{target}</span>
              </p>
              <p className="text-sm text-gray-500">{time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RecentActivity