import { FiUser, FiCalendar } from 'react-icons/fi';
import { Listbox } from '@headlessui/react';

export default function PrioritySelector({ 
  creationIds, 
  changeIds, 
  priorities, 
  onPriorityChange 
}) {
  return (
    <div>
      <h2 className="text-white text-xl mb-4">Priorities</h2>
      
      {/* Creation ID Selector */}
      <div className="mb-4">
        <label className="block text-white mb-2">Creation ID</label>
        <Listbox value={priorities.creationId} onChange={(value) => onPriorityChange('creationId', value)}>
          <div className="relative">
            <Listbox.Button className="flex items-center w-full bg-[#2d2d2d] rounded-lg p-4 border border-[#353535] text-left">
              <FiUser className="text-[#676767] mr-2" />
              <span>{priorities.creationId || 'Select Creation ID'}</span>
            </Listbox.Button>
            <Listbox.Options className="absolute w-full mt-1 bg-[#2d2d2d] rounded-lg border border-[#353535] max-h-60 overflow-auto">
              {creationIds.map((id) => (
                <Listbox.Option
                  key={id}
                  value={id}
                  className={({ active }) =>
                    `p-3 cursor-pointer ${active ? 'bg-blue-600' : ''}`
                  }
                >
                  {id}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>
      </div>

      {/* Change ID Selector */}
      <div className="mb-4">
        <label className="block text-white mb-2">Change ID</label>
        <Listbox value={priorities.changeId} onChange={(value) => onPriorityChange('changeId', value)}>
          <div className="relative">
            <Listbox.Button className="flex items-center w-full bg-[#2d2d2d] rounded-lg p-4 border border-[#353535] text-left">
              <FiUser className="text-[#676767] mr-2" />
              <span>{priorities.changeId || 'Select Change ID'}</span>
            </Listbox.Button>
            <Listbox.Options className="absolute w-full mt-1 bg-[#2d2d2d] rounded-lg border border-[#353535] max-h-60 overflow-auto">
              {changeIds.map((id) => (
                <Listbox.Option
                  key={id}
                  value={id}
                  className={({ active }) =>
                    `p-3 cursor-pointer ${active ? 'bg-blue-600' : ''}`
                  }
                >
                  {id}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>
      </div>

      {/* Date Priorities */}
      <div className="flex space-x-4">
        <label className="flex items-center space-x-2 text-white">
          <input
            type="checkbox"
            checked={priorities.changeDate}
            onChange={(e) => onPriorityChange('changeDate', e.target.checked)}
            className="form-checkbox bg-[#2d2d2d] border-[#353535] rounded"
          />
          <FiCalendar className="text-[#676767]" />
          <span>Prioritize by Change Date</span>
        </label>

        <label className="flex items-center space-x-2 text-white">
          <input
            type="checkbox"
            checked={priorities.creationDate}
            onChange={(e) => onPriorityChange('creationDate', e.target.checked)}
            className="form-checkbox bg-[#2d2d2d] border-[#353535] rounded"
          />
          <FiCalendar className="text-[#676767]" />
          <span>Prioritize by Creation Date</span>
        </label>
      </div>
    </div>
  );
}