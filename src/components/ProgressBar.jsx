import { useEffect, useState, useRef } from 'react'
import { FILE_PROCESSING } from '../utils/constants'

export default function ProgressBar({ progress, total, label }) {
  const [percentage, setPercentage] = useState(0)
  const [smoothProgress, setSmoothProgress] = useState(0)
  const progressRef = useRef(progress)
  const animationRef = useRef(null)
  const lastUpdateRef = useRef(Date.now())

  // Update the real progress value
  useEffect(() => {
    progressRef.current = progress
    lastUpdateRef.current = Date.now()
  }, [progress])

  // Smooth progress animation
  useEffect(() => {
    const animate = () => {
      const now = Date.now()
      const timeDiff = now - lastUpdateRef.current
      
      // Adjust animation speed based on update frequency
      const animationSpeed = timeDiff > 1000 ? 0.05 : 0.1

      setSmoothProgress(prev => {
        const diff = progressRef.current - prev
        if (Math.abs(diff) < 0.1) {
          return progressRef.current
        }
        return prev + diff * animationSpeed
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // Calculate percentage with smooth animation
  useEffect(() => {
    setPercentage(Math.round((smoothProgress / total) * 100))
  }, [smoothProgress, total])

  // Function to get phase-specific color
  const getProgressColor = () => {
    if (label?.toLowerCase().includes('error') || 
        label?.toLowerCase().includes(FILE_PROCESSING.PHASES.ERROR)) {
      return 'bg-red-600'
    }
    if (percentage === 100) {
      return 'bg-green-600'
    }
    return 'bg-blue-600'
  }

  // Function to get formatted counts
  const getProgressText = () => {
    if (total === 100) { // When showing percentage-based progress
      return `${Math.round(smoothProgress)}%`
    }
    return `${Math.round(smoothProgress).toLocaleString()} of ${total.toLocaleString()} segments processed`
  }

  return (
    <div className="w-full bg-[#2d2d2d] p-4 rounded-lg border border-[#353535]">
      <div className="flex justify-between text-sm text-white mb-2">
        <span>{label}</span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ease-out ${getProgressColor()}`}
          style={{ 
            width: `${percentage}%`,
            transition: 'width 0.3s ease-out'
          }}
        />
      </div>
      <div className="flex justify-between text-sm text-[#676767] mt-2">
        <span>{getProgressText()}</span>
        <span>
          {percentage === 100 
            ? 'Complete' 
            : label?.toLowerCase().includes('error')
              ? 'Error'
              : 'Processing...'}
        </span>
      </div>
      {percentage === 100 && !label?.toLowerCase().includes('error') && (
        <div className="text-sm text-green-500 mt-1">
          Processing completed successfully
        </div>
      )}
      {label?.toLowerCase().includes('error') && (
        <div className="text-sm text-red-500 mt-1">
          Error occurred during processing
        </div>
      )}
    </div>
  )
}