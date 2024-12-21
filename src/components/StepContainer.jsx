import { FiCheck } from 'react-icons/fi'

export default function StepContainer({ 
  step, 
  title, 
  description, 
  isCompleted, 
  isActive, 
  children 
}) {
  return (
    <div className={`
      bg-[#171717] rounded-lg p-6 mb-6 border-2
      ${isActive ? 'border-blue-500' : isCompleted ? 'border-green-500' : 'border-[#353535]'}
    `}>
      <div className="flex items-center mb-4">
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center mr-3 text-lg font-bold
          ${isCompleted ? 'bg-green-500 text-white' : isActive ? 'bg-blue-500 text-white' : 'bg-[#2d2d2d] text-[#676767]'}
        `}>
          {isCompleted ? <FiCheck /> : step}
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-[#676767]">{description}</p>
        </div>
      </div>
      <div className={`${!isActive && !isCompleted ? 'opacity-50 pointer-events-none' : ''}`}>
        {children}
      </div>
    </div>
  )
}