import { useState } from 'react'
import FileInput from './components/FileInput'
import ErrorMessage from './components/ErrorMessage'
import PrioritySelector from './components/PrioritySelector'
import DuplicatePreview from './components/DuplicatePreview'
import ProgressBar from './components/ProgressBar'
import { analyzeTMX } from './utils/tmx-analyzer'
import { processTMX } from './utils/tmx-processor'

function App() {
  const [inputFile, setInputFile] = useState(null)
  const [tmxData, setTmxData] = useState(null)
  const [error, setError] = useState(null)
  const [priorities, setPriorities] = useState({
    creationId: '',
    changeId: '',
    changeDate: false,
    creationDate: false
  })
  const [processing, setProcessing] = useState({
    inProgress: false,
    progress: 0,
    total: 0
  })
  const [duplicates, setDuplicates] = useState([])

  const handleFileSelect = async (file) => {
    setInputFile(file)
    setError(null)
    setDuplicates([])
    
    try {
      const analysis = await analyzeTMX(file)
      setTmxData(analysis)
    } catch (error) {
      setError('Failed to analyze TMX file. Please ensure it is a valid TMX file.')
      console.error('Failed to analyze TMX:', error)
    }
  }

  const handlePriorityChange = (key, value) => {
    setPriorities(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleProcess = async () => {
    if (!inputFile) return

    setProcessing({ inProgress: true, progress: 0, total: 0 })
    setError(null)

    try {
      const result = await processTMX(
        inputFile,
        priorities,
        (progress, total) => setProcessing({ inProgress: true, progress, total })
      )

      setDuplicates(result.duplicateGroups)
      setProcessing({ inProgress: false, progress: 0, total: 0 })

      // Create and trigger download of processed file
      const blob = new Blob([result.content], { type: 'text/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `processed_${inputFile.name}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      setError('Failed to process TMX file. Please try again.')
      console.error('Processing error:', error)
      setProcessing({ inProgress: false, progress: 0, total: 0 })
    }
  }

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-[#676767] font-sans">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">TMX Duplicate Remover</h1>
        
        <div className="bg-[#171717] rounded-lg p-6 shadow-lg">
          {error && <ErrorMessage message={error} />}
          
          <FileInput 
            onFileSelect={handleFileSelect}
            selectedFile={inputFile}
          />

          {tmxData && (
            <>
              <div className="mt-8">
                <PrioritySelector
                  creationIds={tmxData.creationIds}
                  changeIds={tmxData.changeIds}
                  priorities={priorities}
                  onPriorityChange={handlePriorityChange}
                />
              </div>

              <div className="mt-8">
                <button
                  onClick={handleProcess}
                  disabled={processing.inProgress}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Process TMX File
                </button>
              </div>

              {processing.inProgress && (
                <div className="mt-8">
                  <ProgressBar 
                    progress={processing.progress}
                    total={processing.total}
                  />
                </div>
              )}

              {duplicates.length > 0 && (
                <DuplicatePreview duplicates={duplicates} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App