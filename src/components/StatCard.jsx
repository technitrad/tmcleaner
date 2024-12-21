import { FiArrowUp, FiArrowDown } from 'react-icons/fi'
import clsx from 'clsx'

function StatCard({ title, value, change, isPositive }) {
  return (
    <div className="bg-[#171717] rounded-lg p-6">
      <h3 className="text-gray-400 text-sm">{title}</h3>
      <div className="mt-2 flex items-baseline">
        <p className="text-2xl font-semibold text-white">{value}</p>
        <span className={clsx(
          'ml-2 flex items-center text-sm',
          isPositive ? 'text-green-500' : 'text-red-500'
        )}>
          {isPositive ? <FiArrowUp className="mr-1" /> : <FiArrowDown className="mr-1" />}
          {change}
        </span>
      </div>
    </div>
  )
}

export default StatCard