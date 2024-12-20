import { useState } from 'react';
import { FiChevronRight, FiChevronDown, FiCheck, FiX } from 'react-icons/fi';

export default function DuplicatePreview({ duplicates }) {
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const toggleGroup = (sourceText) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(sourceText)) {
      newExpanded.delete(sourceText);
    } else {
      newExpanded.add(sourceText);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <div className="mt-6">
      <h2 className="text-white text-xl mb-4">Duplicate Preview</h2>
      <div className="bg-[#2d2d2d] rounded-lg border border-[#353535] overflow-hidden">
        {duplicates.map(({ sourceText, translations }) => (
          <div key={sourceText} className="border-b border-[#353535] last:border-b-0">
            <button
              onClick={() => toggleGroup(sourceText)}
              className="w-full flex items-center justify-between p-4 hover:bg-[#353535] transition-colors"
            >
              <div className="flex items-center">
                {expandedGroups.has(sourceText) ? (
                  <FiChevronDown className="text-[#676767] mr-2" />
                ) : (
                  <FiChevronRight className="text-[#676767] mr-2" />
                )}
                <span className="text-white">{sourceText}</span>
              </div>
              <span className="text-[#676767]">{translations.length} versions</span>
            </button>
            
            {expandedGroups.has(sourceText) && (
              <div className="px-4 pb-4">
                {translations.map((tu, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg mb-2 last:mb-0 flex items-start justify-between ${
                      tu.isKept ? 'bg-green-900 bg-opacity-20' : 'bg-red-900 bg-opacity-20'
                    }`}
                  >
                    <div>
                      <div className="text-white mb-1">{tu.targetText}</div>
                      <div className="text-sm text-[#676767]">
                        Created by {tu.creationId} on {new Date(tu.creationDate).toLocaleDateString()}
                        {tu.changeId && ` • Modified by ${tu.changeId}`}
                        {tu.changeDate && ` on ${new Date(tu.changeDate).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div className="ml-4">
                      {tu.isKept ? (
                        <FiCheck className="text-green-500" />
                      ) : (
                        <FiX className="text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}