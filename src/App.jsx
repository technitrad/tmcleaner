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
    type: null, 
    processed: 0, 
    total: 0,
    stage: null 
  })
  
  const completedSteps = useRef(new Set())
  const activeWorker = useRef(null)
  const abortController = useRef(null)
  
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

  useEffect(() => {
    return () => {
      cleanupResources();
    }
  }, [])

  const cleanupResources = useCallback(() => {
    if (activeWorker.current) {
      activeWorker.current.terminate();
      activeWorker.current = null;
    }
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }
  }, [])

  const handleProgress = useCallback((progressData) => {
    if (!progressData || typeof progressData !== 'object') {
      console.error('Invalid progress data received');
      return;
    }
    setProgress(progressData);
  }, [])

  const updateStepCompletion = useCallback((step, isComplete) => {
    if (typeof step !== 'number' || step < 1 || step > 4) {
      console.error('Invalid step number:', step);
      return;
    }

    if (isComplete) {
      completedSteps.current.add(step);
      if (currentStep === step) {
        setCurrentStep(prev => Math.min(prev + 1, 4));
      }
    } else {
      completedSteps.current.delete(step);
    }
  }, [currentStep])

  const handleFileSelect = useCallback(async (file) => {
    if (!file || !(file instanceof File)) {
      toast.error('Invalid file selected');
      return;
    }

    try {
      cleanupResources();
      abortController.current = new AbortController();

      setInputFile(file);
      setProcessing(true);
      
      const result = await processTMXFile(file, handleProgress);
      if (!result || !result.content || !result.metadata) {
        throw new Error('Invalid TMX processing result');
      }

      setMetadata(result.metadata);
      setTmxData(result.content);
      
      setProgress({ type: null, processed: 0, total: 0, stage: null });
      updateStepCompletion(1, true);
      toast.success('TMX file loaded successfully');
    } catch (error) {
      console.error('File processing error:', error);
      toast.error(error.message || 'Failed to process TMX file');
      setInputFile(null);
      setMetadata(null);
      setTmxData(null);
      updateStepCompletion(1, false);
    } finally {
      setProcessing(false);
    }
  }, [updateStepCompletion, handleProgress, cleanupResources])

  const handlePriorityChange = useCallback((key, value) => {
    if (!key || value === undefined) {
      console.error('Invalid priority change parameters');
      return;
    }

    setPriorities(prev => {
      const updated = { ...prev, [key]: value };
      updateStepCompletion(2, true);
      return updated;
    });
  }, [updateStepCompletion])

  const handleOptionsChange = useCallback((key, value) => {
    if (!key || value === undefined) {
      console.error('Invalid options change parameters');
      return;
    }

    setOptions(prev => ({ ...prev, [key]: value }));
  }, [])

  const handleAnalyzeDuplicates = useCallback(async () => {
    console.log('Analyze button clicked');
    if (!tmxData) {
      toast.error('Please select a TMX file first');
      return;
    }

    console.log('TMX data exists:', tmxData.tmx?.body?.tu?.length);

    if (!tmxData.tmx?.body?.tu) {
      toast.error('Invalid TMX structure');
      return;
    }

    try {
      console.log('Starting analysis process');
      cleanupResources();
      setProcessing(true);

      const worker = new Worker(new URL('./utils/worker.js', import.meta.url));
      console.log('Worker created');
      activeWorker.current = worker;

      worker.onmessage = (e) => {
        console.log('Worker message received:', e.data);
        const { type, data } = e.data;
        
        if (!type || !data) {
          console.error('Invalid worker message received');
          return;
        }

        switch (type) {
          case 'progress':
            if (typeof data.processed === 'number' && typeof data.total === 'number') {
              setProgress({
                type: 'analyzing',
                processed: data.processed,
                total: data.total,
                stage: data.stage
              });
            }
            break;

          case 'complete':
            if (Array.isArray(data)) {
              setDuplicates(data);
              updateStepCompletion(3, true);
              worker.terminate();
              activeWorker.current = null;
              toast.success(`Found ${data.length} segments to analyze`);
            } else {
              throw new Error('Invalid duplicate analysis result');
            }
            break;

          case 'error':
            throw new Error(data);

          default:
            console.warn('Unknown message type from worker:', type);
        }
      };

      worker.onerror = (error) => {
        throw new Error(`Worker error: ${error.message}`);
      };

      worker.postMessage({
        type: 'analyzeDuplicates',
        data: { tmxData, priorities, options }
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error.message || 'Failed to analyze duplicates');
      updateStepCompletion(3, false);
    } finally {
      setProcessing(false);
    }
  }, [tmxData, priorities, options, updateStepCompletion, cleanupResources])

  const handleDuplicateStatusChange = useCallback((updatedDuplicates) => {
    if (!Array.isArray(updatedDuplicates)) {
      console.error('Invalid duplicates update');
      return;
    }
    setDuplicates(updatedDuplicates);
  }, [])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!inputFile || !duplicates) {
      toast.error('Please complete all previous steps first');
      return;
    }

    if (!tmxData?.tmx?.body?.tu) {
      toast.error('Invalid TMX data structure');
      return;
    }

    try {
      cleanupResources();
      abortController.current = new AbortController();
      setProcessing(true);

      setProgress({ 
        type: 'processing', 
        processed: 0, 
        total: tmxData.tmx.body.tu.length,
        stage: 'processing' 
      });

      const result = await processTMX(
        inputFile, 
        priorities, 
        duplicates, 
        (processed, total, stage) => {
          if (typeof processed === 'number' && typeof total === 'number') {
            setProgress(prev => ({
              ...prev,
              processed,
              total,
              stage
            }));
          }
        }
      );

      if (!result?.blob || !result?.downloadName) {
        throw new Error('Invalid processing result');
      }
      
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      updateStepCompletion(4, true);
      toast.success('TMX file processed and downloaded successfully');
    } catch (error) {
      console.error('Processing error:', error);
      toast.error(error.message || 'Failed to process TMX file');
      updateStepCompletion(4, false);
    } finally {
      setProcessing(false);
      setProgress({ type: null, processed: 0, total: 0, stage: null });
    }
  }, [inputFile, duplicates, tmxData, priorities, updateStepCompletion, cleanupResources])

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

            {progress.type && (
              <div className="mt-4">
                <ProgressBar 
                  progress={progress.processed}
                  total={progress.total}
                  label={getProgressLabel(progress)}
                  stage={progress.stage}
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
                    <div>File Size: {formatFileSize(inputFile.size)}</div>
                    <div>Segment Type: {metadata.segmentType}</div>
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
                  progress={progress.processed}
                  total={progress.total}
                  label={getProgressLabel(progress)}
                  stage={progress.stage}
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
                  progress={progress.processed}
                  total={progress.total}
                  label={getProgressLabel(progress)}
                  stage={progress.stage}
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

function getProgressLabel({ type, stage }) {
  switch (type) {
    case 'loading':
      return stage === 'reading' ? 'Reading TMX file...' : 'Loading TMX file...';
    case 'parsing':
      return 'Parsing TMX content...';
    case 'analyzing':
      return stage === 'sorting' ? 'Sorting duplicates...' : 'Analyzing duplicates...';
    case 'processing':
      return 'Processing TMX file...';
    default:
      return 'Processing...';
  }
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export default App