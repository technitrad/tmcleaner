import { FiUpload } from 'react-icons/fi'
import { useCallback } from 'react'

export default function FileUpload({ onFileSelect, selectedFile }) {
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.tmx')) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  return (
    <div>
      <label className="block text-white mb-2">Input TMX File</label>
      <div 
        className="flex items-center space-x-4"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <div className="flex-1 bg-[#2d2d2d] rounded-lg p-4 border border-[#353535]">
          <div className="flex items-center">
            <FiUpload className="text-[#676767] mr-2" />
            <span>{selectedFile?.name || 'Drop TMX file here or click Browse'}</span>
          </div>
        </div>
        <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Browse
          <input
            type="file"
            accept=".tmx"
            className="hidden"
            onChange={(e) => onFileSelect(e.target.files[0])}
          />
        </label>
      </div>
    </div>
  )
}