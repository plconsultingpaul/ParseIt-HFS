import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Variable {
  name: string;
  stepName: string;
  source?: 'extraction' | 'workflow';
  dataType?: string;
}

interface VariableDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  variables: Variable[];
  onSelect: (variableName: string) => void;
}

export default function VariableDropdown({
  isOpen,
  onClose,
  triggerRef,
  variables,
  onSelect
}: VariableDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const dropdownMaxHeight = 320;

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const updatePosition = () => {
        const triggerRect = triggerRef.current!.getBoundingClientRect();
        const dropdownWidth = 256;

        let left = triggerRect.right - dropdownWidth;
        let top = triggerRect.bottom + 4;

        if (left < 8) {
          left = 8;
        }

        const viewportHeight = window.innerHeight;
        if (top + dropdownMaxHeight > viewportHeight - 8) {
          top = triggerRect.top - dropdownMaxHeight - 4;
          if (top < 8) {
            top = 8;
          }
        }

        setPosition({ top, left });
      };

      updatePosition();

      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const extractionVariables = variables.filter(v => v.source === 'extraction');
  const workflowVariables = variables.filter(v => v.source === 'workflow' || !v.source);

  const dropdown = (
    <div
      ref={dropdownRef}
      className="fixed w-72 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg overflow-y-auto"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxHeight: `${dropdownMaxHeight}px`,
        zIndex: 9999
      }}
    >
      {variables.length === 0 ? (
        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
          No variables available
        </div>
      ) : (
        <div>
          {extractionVariables.length > 0 && (
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20">
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                  PDF Extracted Fields
                </span>
              </div>
              <div>
                {extractionVariables.map((variable, idx) => (
                  <button
                    key={`extraction-${idx}`}
                    type="button"
                    onClick={() => onSelect(variable.name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 flex flex-col border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <span className="font-mono text-gray-900 dark:text-gray-100">{variable.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-purple-600 dark:text-purple-400">
                        {variable.stepName}
                      </span>
                      {variable.dataType && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {variable.dataType}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {workflowVariables.length > 0 && (
            <div>
              <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Previous Workflow Steps
                </span>
              </div>
              <div>
                {workflowVariables.map((variable, idx) => (
                  <button
                    key={`workflow-${idx}`}
                    type="button"
                    onClick={() => onSelect(variable.name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 flex flex-col border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <span className="font-mono text-gray-900 dark:text-gray-100">{variable.name}</span>
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      from {variable.stepName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(dropdown, document.body);
}
