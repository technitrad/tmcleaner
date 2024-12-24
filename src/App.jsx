import { useState, useCallback, useRef, useEffect } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import FileUpload from './components/FileUpload'
import PrioritySelector from './components/PrioritySelector'
import LanguageDisplay from './components/LanguageDisplay'
import DuplicatePreview from './components/DuplicatePreview'
import ProgressBar from './components/ProgressBar'
import StepContainer from './components/StepContainer'
import { processTMXFile } from './utils/file-processor'
import { analyzeDuplicates } from './utils/duplicate-analyzer'
import { processTMX } from './utils/tmx-processor'

function App() {
  const [inputFile, setInputFile] = useState(null)
  const [metadata, setMetadata] = useState(null)
  const [tmxData, setTmxData] = useState(null)
  const [duplicates, setDuplicates] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [progress, setProgress] = useState({
    phase: null,
    type: null,
    current: 0,
    total: 0,
    message: ''
  })
  const completedSteps = useRef(new Set())
  const workerRef = useRef(null)
  
  const [priorities, setPriorities] = useState({
    creationId: [],
    changeId: [],
    changeDate: false,
    creationDate: false,
    priorityOrder: 'ids'
  })

  const [options, setOptions] = useState({
    matchMode: 'sourcesEqual',
    caseSensitive: false,
    ignorePunctuation: false,
    ignoreWhitespace: true,
    tagStrictness: 'permissive'
  })

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [])

  // Listen for progress events from different processes
  useEffect(() => {
    const handleFileProgress = (event) => {
      const { phase, progress } = event.detail;
      setProgress(prev => ({
        ...prev,
        phase,
        current: progress,
        total: 100,
        type: 'loading',
        message: getProgressMessage(phase)
      }))
    }

    const handleTMXProgress = (event) => {
      const { phase, progress } = event.detail;
      setProgress(prev => ({
        ...prev,
        phase,
        current: progress,
        total: 100,
        type: 'processing',
        message: getProgressMessage(phase)
      }))
    }

    window.addEventListener('fileProcessProgress', handleFileProgress)
    window.addEventListener('tmxProcessProgress', handleTMXProgress)

    return () => {
      window.removeEventListener('fileProcessProgress', handleFileProgress)
      window.removeEventListener('tmxProcessProgress', handleTMXProgress)
    }
  }, [])

  const getProgressMessage = (phase) => {
    switch (phase) {
      case 'reading': return 'Reading file...'
      case 'detecting': return 'Detecting encoding...'
      case 'decoding': return 'Decoding content...'
      case 'parsing': return 'Parsing TMX content...'
      case 'analyzing': return 'Analyzing duplicates...'
      case 'filtering': return 'Filtering duplicates...'
      case 'processing': return 'Processing TMX file...'
      case 'finalizing': return 'Finalizing...'
      default: return 'Processing...'
    }
  }

  const updateStepCompletion = useCallback((step, isComplete) => {
    if (isComplete) {
      completedSteps.current.add(step)
      if (currentStep === step) {
        setCurrentStep(step + 1)
      }
    } else {
      completedSteps.current.delete(step)
    }
  }, [currentStep])

  const handleFileSelect = useCallback(async (file) => {
    try {
      setInputFile(file)
      setProgress({
        phase: 'reading',
        type: 'loading',
        current: 0,
        total: 100,
        message: 'Reading file...'
      })
      
      const result = await processTMXFile(file)
      setMetadata(result.metadata)
      setTmxData(result.content)
      
      setProgress({
        phase: 'complete',
        type: null,
        current: 0,
        total: 0,
        message: ''
      })
      updateStepCompletion(1, true)
      toast.success('TMX file loaded successfully')
    } catch (error) {
      console.error('File processing error:', error)
      toast.error(error.message)
      setInputFile(null)
      setMetadata(null)
      setTmxData(null)
      setProgress({
        phase: 'error',
        type: null,
        current: 0,
        total: 0,
        message: error.message
      })
    }
  }, [updateStepCompletion])

  const handlePriorityChange = useCallback((key, value) => {
    setPriorities(prev => {
      const updated = { ...prev, [key]: value }
      updateStepCompletion(2, true)
      return updated
    })
  }, [updateStepCompletion])

  const handleOptionsChange = useCallback((key, value) => {
    setOptions(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleAnalyzeDuplicates = useCallback(async () => {
    if (!tmxData) {
      toast.error('Please select a TMX file first')
      return
    }

    try {
      setProcessing(true)
      setProgress({
        phase: 'analyzing',
        type: 'analyzing',
        current: 0,
        total: tmxData.tmx.body.tu.length,
        message: 'Analyzing duplicates...'
      })

      // Cleanup previous worker if exists
      if (workerRef.current) {
        workerRef.current.terminate()
      }

      workerRef.current = new Worker(new URL('./utils/worker.js', import.meta.url))
      
      workerRef.current.onmessage = (e) => {
        const { type, data } = e.data
        
        switch (type) {
          case 'progress':
            setProgress(prev => ({
              ...prev,
              current: data.processed,
              ...(data.phase && { phase: data.phase }),
              ...(data.subProgress && { subProgress: data.subProgress })
            }))
            break
          case 'complete':
            setDuplicates(data)
            updateStepCompletion(3, true)
            setProcessing(false)
            workerRef.current.terminate()
            workerRef.current = null
            toast.success(`Found ${data.length} segments to analyze`)
            break
          case 'error':
            throw new Error(data)
        }
      }

      workerRef.current.postMessage({
        type: 'analyzeDuplicates',
        data: { tmxData, priorities, options }
      })
    } catch (error) {
      console.error('Analysis error:', error)
      toast.error('Failed to analyze duplicates')
      setProcessing(false)
      setProgress({
        phase: 'error',
        type: null,
        current: 0,
        total: 0,
        message: error.message
      })
    }
  }, [tmxData, priorities, options, updateStepCompletion])

  const handleDuplicateStatusChange = useCallback((updatedDuplicates) => {
    setDuplicates(updatedDuplicates)
  }, [])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!inputFile || !duplicates) {
      toast.error('Please complete all previous steps first')
      return
    }

    try {
      setProcessing(true)
      setProgress({
        phase: 'processing',
        type: 'processing',
        current: 0,
        total: tmxData.tmx.body.tu.length,
        message: 'Processing TMX file...'
      })

      const result = await processTMX(inputFile, priorities, duplicates)
      
      // Create download link
      const url = URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.downloadName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      updateStepCompletion(4, true)
      toast.success('TMX file processed and downloaded successfully')
    } catch (error) {
      console.error('Processing error:', error)
      toast.error(error.message)
      setProgress({
        phase: 'error',
        type: null,
        current: 0,
        total: 0,
        message: error.message
      })
    } finally {
      setProcessing(false)
    }
  }, [inputFile, duplicates, tmxData, priorities, updateStepCompletion])

  const getProgressLabel = useCallback(() => {
    if (progress.phase === 'error') {
      return `Error: ${progress.message}`
    }
    return progress.message || getProgressMessage(progress.phase)
  }, [progress.phase, progress.message])

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-[#676767] font-sans">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">TMX Duplicate Remover</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <StepContainer
            step={1}
            title="Select TMX File"
            description="Upload your TMX file to begin the duplicate removal process"
            isActive={currentStep === 1}
            isCompleted={completedSteps.current.has(1)}
          >
            <FileUpload 
              onFileSelect={handleFileSelect}
              selectedFile={inputFile}
            />

            {progress.type === 'loading' && (
              <div className="mt-4">
                <ProgressBar 
                  progress={progress.current}
                  total={progress.total}
                  label={getProgressLabel()}
                />
              </div>
            )}

            {metadata && (
              <div className="mt-4">
                <LanguageDisplay 
                  sourceLanguage={metadata.sourceLanguage}
                  targetLanguage={metadata.targetLanguage}
                />

                <div className="bg-[#2d2d2d] rounded-lg p-4 mt-4">
                  <h3 className="text-white mb-2">File Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>Total Segments: {metadata.totalSegments.toLocaleString()}</div>
                    <div>Creation Tool: {metadata.creationTool} {metadata.creationToolVersion}</div>
                  </div>
                </div>
              </div>
            )}
          </StepContainer>

          <StepContainer
            step={2}
            title="Configure Priority Settings"
            description="Set up how duplicates should be handled and which versions to keep"
            isActive={currentStep === 2}
            isCompleted={completedSteps.current.has(2)}
          >
            <PrioritySelector
              priorities={priorities}
              onPriorityChange={handlePriorityChange}
              metadata={metadata}
              options={options}
              onOptionsChange={handleOptionsChange}
            />
          </StepContainer>

          <StepContainer
            step={3}
            title="Analyze Duplicates"
            description="Review and confirm which segments to keep or remove"
            isActive={currentStep === 3}
            isCompleted={completedSteps.current.has(3)}
          >
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleAnalyzeDuplicates}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={processing || !metadata}
              >
                Analyze Duplicates
              </button>

              {progress.type === 'analyzing' && (
                <ProgressBar 
                  progress={progress.current}
                  total={progress.total}
                  label={getProgressLabel()}
                />
              )}

              {duplicates && duplicates.length > 0 && (
                <DuplicatePreview 
                  duplicates={duplicates}
                  onStatusChange={handleDuplicateStatusChange}
                />
              )}
            </div>
          </StepContainer>

          <StepContainer
            step={4}
            title="Process and Download"
            description="Generate and download the processed TMX file"
            isActive={currentStep === 4}
            isCompleted={completedSteps.current.has(4)}
          >
            <div className="space-y-4">
              <button
                type="submit"
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={processing || !duplicates}
              >
                Process TMX File
              </button>

              {progress.type === 'processing' && (
                <ProgressBar 
                  progress={progress.current}
                  total={progress.total}
                  label={getProgressLabel()}
                />
              )}
            </div>
          </StepContainer>
        </form>
      </div>
      <Toaster position="top-right" />
    </div>
  )
}

export default App