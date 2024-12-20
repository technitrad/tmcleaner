export default function ProgressBar({ progress, total }) {
  const percentage = Math.round((progress / total) * 100);
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-[#676767] mb-1">
        <span>Processing segments...</span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full h-2 bg-[#2d2d2d] rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-sm text-[#676767] mt-1">
        {progress} of {total} segments processed
      </div>
    </div>
  );
}