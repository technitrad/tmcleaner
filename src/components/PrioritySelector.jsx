import { FiUser, FiCalendar, FiSettings } from 'react-icons/fi'
import Select from 'react-select'
import clsx from 'clsx'

const customSelectStyles = {
  control: (base) => ({
    ...base,
    background: '#2d2d2d',
    borderColor: '#353535',
    '&:hover': {
      borderColor: '#454545'
    }
  }),
  menu: (base) => ({
    ...base,
    background: '#2d2d2d',
    border: '1px solid #353535'
  }),
  option: (base, { isFocused, isSelected }) => ({
    ...base,
    backgroundColor: isSelected ? '#454545' : isFocused ? '#353535' : '#2d2d2d',
    color: 'white',
    '&:active': {
      backgroundColor: '#454545'
    }
  }),
  multiValue: (base, { data }) => ({
    ...base,
    backgroundColor: '#454545',
    padding: '2px'
  }),
  multiValueLabel: (base, { data }) => ({
    ...base,
    color: 'white',
    '&::before': {
      content: `"${data.priority}. "`,
      color: '#9CA3AF'
    }
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'white',
    '&:hover': {
      backgroundColor: '#555555',
      color: 'white'
    }
  }),
  input: (base) => ({
    ...base,
    color: 'white'
  }),
  placeholder: (base) => ({
    ...base,
    color: '#676767'
  })
}

export default function PrioritySelector({ priorities, onPriorityChange, metadata, options, onOptionsChange }) {
  const creationIdOptions = metadata?.creationIds.map(id => ({ value: id, label: id })) || []
  const changeIdOptions = metadata?.changeIds.map(id => ({ value: id, label: id })) || []

  // Add priority numbers to selected values
  const selectedCreationIds = priorities.creationId.map((id, index) => ({
    value: id,
    label: id,
    priority: index + 1
  }))

  const selectedChangeIds = priorities.changeId.map((id, index) => ({
    value: id,
    label: id,
    priority: index + 1
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-xl mb-4">Priorities</h2>
        
        <div className="space-y-4">
          <div className="bg-[#2d2d2d] p-4 rounded-lg border border-[#353535]">
            <h3 className="text-white mb-3">Priority Order</h3>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 text-white">
                <input
                  type="radio"
                  name="priorityOrder"
                  value="ids"
                  checked={priorities.priorityOrder === 'ids'}
                  onChange={(e) => onPriorityChange('priorityOrder', e.target.value)}
                  className="form-radio bg-[#2d2d2d] border-[#353535]"
                />
                <span>IDs First, Then Dates</span>
              </label>
              <label className="flex items-center space-x-2 text-white">
                <input
                  type="radio"
                  name="priorityOrder"
                  value="dates"
                  checked={priorities.priorityOrder === 'dates'}
                  onChange={(e) => onPriorityChange('priorityOrder', e.target.value)}
                  className="form-radio bg-[#2d2d2d] border-[#353535]"
                />
                <span>Dates First, Then IDs</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-white mb-2">Creation ID Priority Order</label>
            <div className="space-y-2">
              <Select
                isMulti
                options={creationIdOptions}
                value={selectedCreationIds}
                onChange={(selected) => {
                  onPriorityChange('creationId', (selected || []).map(option => option.value))
                }}
                styles={customSelectStyles}
                placeholder="Select creation IDs in priority order..."
                components={{
                  DropdownIndicator: () => <FiUser className="text-[#676767] mr-2" />
                }}
              />
              <div className="text-sm text-gray-400">
                IDs are prioritized in the order selected (1 is highest priority)
              </div>
            </div>
          </div>

          <div>
            <label className="block text-white mb-2">Change ID Priority Order</label>
            <div className="space-y-2">
              <Select
                isMulti
                options={changeIdOptions}
                value={selectedChangeIds}
                onChange={(selected) => {
                  onPriorityChange('changeId', (selected || []).map(option => option.value))
                }}
                styles={customSelectStyles}
                placeholder="Select change IDs in priority order..."
                components={{
                  DropdownIndicator: () => <FiUser className="text-[#676767] mr-2" />
                }}
              />
              <div className="text-sm text-gray-400">
                IDs are prioritized in the order selected (1 is highest priority)
              </div>
            </div>
          </div>

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
      </div>

      <div>
        <h2 className="text-white text-xl mb-4 flex items-center">
          <FiSettings className="mr-2" />
          Matching Options
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-white mb-2">Match Mode</label>
            <select
              value={options.matchMode}
              onChange={(e) => onOptionsChange('matchMode', e.target.value)}
              className="w-full bg-[#2d2d2d] text-white border border-[#353535] rounded-md p-2"
            >
              <option value="sourcesEqual">Sources Equal</option>
              <option value="targetsEqual">Targets Equal</option>
              <option value="bothEqual">Sources and Targets Equal</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center space-x-2 text-white">
              <input
                type="checkbox"
                checked={options.caseSensitive}
                onChange={(e) => onOptionsChange('caseSensitive', e.target.checked)}
                className="form-checkbox bg-[#2d2d2d] border-[#353535] rounded"
              />
              <span>Case Sensitive</span>
            </label>

            <label className="flex items-center space-x-2 text-white">
              <input
                type="checkbox"
                checked={options.ignorePunctuation}
                onChange={(e) => onOptionsChange('ignorePunctuation', e.target.checked)}
                className="form-checkbox bg-[#2d2d2d] border-[#353535] rounded"
              />
              <span>Ignore Punctuation</span>
            </label>

            <label className="flex items-center space-x-2 text-white">
              <input
                type="checkbox"
                checked={options.ignoreWhitespace}
                onChange={(e) => onOptionsChange('ignoreWhitespace', e.target.checked)}
                className="form-checkbox bg-[#2d2d2d] border-[#353535] rounded"
              />
              <span>Ignore Whitespace</span>
            </label>
          </div>

          <div>
            <label className="block text-white mb-2">Tag Strictness</label>
            <select
              value={options.tagStrictness}
              onChange={(e) => onOptionsChange('tagStrictness', e.target.value)}
              className="w-full bg-[#2d2d2d] text-white border border-[#353535] rounded-md p-2"
            >
              <option value="permissive">Permissive (Number of tags)</option>
              <option value="medium">Medium (Tag types)</option>
              <option value="strict">Strict (Exact match)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}