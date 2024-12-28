import { useEffect, useState, useRef } from 'react'

export default function ProgressBar({ progress, total, label, stage }) {
  if (!Number.isFinite(progress) || !Number.isFinite(total)) {
    console.error('Invalid progress or total value:', { progress, total });
    return null;
  }

  const [percentage, setPercentage] = useState(0)
  const [smoothProgress, setSmoothProgress] = useState(0)
  const lastUpdateTime = useRef(Date.now())
  const animationFrame = useRef(null)
  const lastPercentage = useRef(0)
  const operationId = useRef(Date.now())
  const progressQueue = useRef([])
  const isProcessing = useRef(false)
  
  useEffect(() => {
    try {
      progressQueue.current.push({ progress, total })
      processQueue()
    } catch (error) {
      console.error('Error queuing progress update:', error);
    }

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
        animationFrame.current = null;
      }
    }
  }, [progress, total])

  const processQueue = async () => {
    if (isProcessing.current || progressQueue.current.length === 0) return
    
    isProcessing.current = true
    const { progress, total } = progressQueue.current.shift()
    
    try {
      await updateProgress(progress, total)
    } catch (error) {
      console.error('Error processing progress queue:', error);
    } finally {
      isProcessing.current = false
      if (progressQueue.current.length > 0) {
        processQueue()
      }
    }
  }

  const updateProgress = async (progress, total) => {
    if (total === 0) return;

    const currentOperationId = operationId.current
    const currentTime = Date.now()
    const timeDiff = currentTime - lastUpdateTime.current
    lastUpdateTime.current = currentTime

    try {
      const targetPercentage = Math.round((progress / total) * 100)
      const percentageDiff = Math.abs(targetPercentage - lastPercentage.current)
      
      if (percentageDiff > 20 && lastPercentage.current !== 0) {
        setPercentage(prev => prev + Math.sign(targetPercentage - prev) * 5)
      } else {
        setPercentage(targetPercentage)
      }
      
      lastPercentage.current = targetPercentage

      return new Promise(resolve => {
        const animate = () => {
          if (operationId.current !== currentOperationId) {
            resolve()
            return
          }

          setSmoothProgress(prev => {
            const diff = percentage - prev
            const step = Math.max(0.1, Math.abs(diff) * 0.1)
            const newProgress = diff > 0 ? 
              Math.min(prev + step, percentage) : 
              Math.max(prev - step, percentage)
            
            if (Math.abs(newProgress - percentage) > 0.1 && 
                operationId.current === currentOperationId) {
              animationFrame.current = requestAnimationFrame(animate)
            } else {
              resolve()
            }
            return newProgress
          })
        }

        if (animationFrame.current) {
          cancelAnimationFrame(animationFrame.current)
        }
        animationFrame.current = requestAnimationFrame(animate)
      })
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  }

  const getProcessingSpeed = () => {
    if (progress === 0 || progress === total || !lastUpdateTime.current) return ''
    
    try {
      const elapsedTime = (Date.now() - lastUpdateTime.current) / 1000
      if (elapsedTime <= 0) return ''
      
      const segmentsPerSecond = progress / elapsedTime
      if (!Number.isFinite(segmentsPerSecond)) return ''
      
      return `${Math.round(segmentsPerSecond)} segments/s`
    } catch (error) {
      console.error('Error calculating processing speed:', error);
      return '';
    }
  }

  const getETA = () => {
    if (progress === 0 || progress === total || !lastUpdateTime.current) return ''
    
    try {
      const elapsedTime = Date.now() - lastUpdateTime.current
      if (elapsedTime <= 0) return ''
      
      const rate = progress / elapsedTime
      if (!Number.isFinite(rate) || rate <= 0) return ''
      
      const remainingTime = (total - progress) / rate
      if (remainingTime < 0 || !isFinite(remainingTime)) return ''
      
      const minutes = Math.floor(remainingTime / 60000)
      const seconds = Math.floor((remainingTime % 60000) / 1000)
      return `ETA: ${minutes}m ${seconds}s`
    } catch (error) {
      console.error('Error calculating ETA:', error);
      return '';
    }
  }

  if (percentage < 0 || percentage > 100) {
    console.error('Invalid percentage value:', percentage);
    return null;
  }

  return (
    <div className="w-full bg-[#2d2d2d] p-4 rounded-lg border border-[#353535]">
      <div className="flex justify-between text-sm text-white mb-2">
        <div className="flex items-center space-x-2">
          <span>{label || 'Processing...'}</span>
          {stage && (
            <span className="text-[#676767]">({stage})</span>
          )}
        </div>
        <span>{percentage.toFixed(1)}%</span>
      </div>
      <div className="w-full h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-600 transition-transform duration-100 ease-out"
          style={{ 
            transform: `translateX(${Math.max(-100, Math.min(smoothProgress - 100, 0))}%)`,
            width: '100%'
          }}
        />
      </div>
      <div className="flex justify-between text-sm text-[#676767] mt-2">
        <div>
          {progress.toLocaleString()} of {total.toLocaleString()} segments
          {progress > 0 && progress < total && (
            <span className="ml-2">({getProcessingSpeed()})</span>
          )}
        </div>
        <div>{getETA()}</div>
      </div>
    </div>
  )
}