import { FiGlobe } from 'react-icons/fi'

export default function LanguageDisplay({ sourceLanguage, targetLanguage }) {
  return (
    <div className="bg-[#2d2d2d] rounded-lg p-4 mb-4">
      <div className="flex items-center mb-4">
        <FiGlobe className="text-[#676767] mr-2" />
        <h3 className="text-white text-lg">Language Information</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="text-[#676767] mb-1">File Source Language:</div>
          <div className="text-white text-lg">{sourceLanguage}</div>
        </div>
        <div>
          <div className="text-[#676767] mb-1">File Target Language:</div>
          <div className="text-white text-lg">{targetLanguage}</div>
        </div>
      </div>
    </div>
  )
}