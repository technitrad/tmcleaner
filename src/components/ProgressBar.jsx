import { useEffect, useState } from 'react'

export default function ProgressBar({ progress, total, label }) {
  const [percentage, setPercentage] = useState(0)
  
  useEffect(() => {
    setPercentage(Math.round((progress / total) * 100))
  }, [progress, total])

  return (
    <div className="w-full bg-[#2d2d2d] p-4 rounded-lg border border-[#353535]">
      <div className="flex justify-between text-sm text-white mb-2">
        <span>{label}</span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-sm text-[#676767] mt-2">
        {progress.toLocaleString()} of {total.toLocaleString()} segments processed
      </div>
    </div>
  )
}