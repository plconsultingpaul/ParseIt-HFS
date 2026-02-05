import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Users, Globe, GitBranch, Mail, Upload, FileText, Cog, Edit2, Trash2, HelpCircle, LogOut, Sparkles } from 'lucide-react';

interface GroupNodeData {
  label: string;
  groupId?: string;
  groupName?: string;
  fieldCount?: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

interface WorkflowNodeData {
  label: string;
  stepType: string;
  config?: any;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const GroupNode = memo(({ data, selected }: NodeProps<GroupNodeData>) => {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 min-w-[200px] shadow-md transition-all ${
        selected
          ? 'border-blue-500 shadow-blue-200 dark:shadow-blue-900/50'
          : 'border-blue-300 dark:border-blue-600'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              Form Group
            </div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{data.label}</div>
            {data.fieldCount !== undefined && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {data.fieldCount} {data.fieldCount === 1 ? 'field' : 'fields'}
              </div>
            )}
          </div>
        </div>
        {(data.onEdit || data.onDelete) && (
          <div className="flex items-center space-x-1 ml-3">
            {data.onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onEdit?.();
                }}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
            {data.onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onDelete?.();
                }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
    </div>
  );
});

GroupNode.displayName = 'GroupNode';

const getWorkflowIcon = (stepType: string) => {
  switch (stepType) {
    case 'api_call':
    case 'api_endpoint':
      return <Globe className="h-4 w-4" />;
    case 'conditional_check':
    case 'branch':
      return <GitBranch className="h-4 w-4" />;
    case 'email_action':
      return <Mail className="h-4 w-4" />;
    case 'sftp_upload':
      return <Upload className="h-4 w-4" />;
    case 'rename_file':
      return <FileText className="h-4 w-4" />;
    case 'user_confirmation':
      return <HelpCircle className="h-4 w-4" />;
    case 'exit':
      return <LogOut className="h-4 w-4" />;
    case 'ai_lookup':
      return <Sparkles className="h-4 w-4" />;
    default:
      return <Cog className="h-4 w-4" />;
  }
};

const getWorkflowLabel = (stepType: string) => {
  switch (stepType) {
    case 'api_call': return 'API Call';
    case 'api_endpoint': return 'API Endpoint';
    case 'conditional_check': return 'Decision';
    case 'branch': return 'Branch';
    case 'email_action': return 'Email';
    case 'sftp_upload': return 'SFTP Upload';
    case 'rename_file': return 'Rename File';
    case 'data_transform': return 'Transform';
    case 'user_confirmation': return 'User Confirmation';
    case 'exit': return 'Exit';
    case 'ai_lookup': return 'AI Lookup';
    default: return 'Workflow';
  }
};

const getWorkflowColor = (stepType: string) => {
  switch (stepType) {
    case 'api_call':
    case 'api_endpoint':
      return {
        bg: 'bg-green-100 dark:bg-green-900/50',
        text: 'text-green-600 dark:text-green-400',
        border: 'border-green-300 dark:border-green-600',
        selectedBorder: 'border-green-500',
        shadow: 'shadow-green-200 dark:shadow-green-900/50',
        handle: '!bg-green-500'
      };
    case 'conditional_check':
      return {
        bg: 'bg-orange-100 dark:bg-orange-900/50',
        text: 'text-orange-600 dark:text-orange-400',
        border: 'border-orange-300 dark:border-orange-600',
        selectedBorder: 'border-orange-500',
        shadow: 'shadow-orange-200 dark:shadow-orange-900/50',
        handle: '!bg-orange-500'
      };
    case 'branch':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/50',
        text: 'text-yellow-600 dark:text-yellow-400',
        border: 'border-yellow-300 dark:border-yellow-600',
        selectedBorder: 'border-yellow-500',
        shadow: 'shadow-yellow-200 dark:shadow-yellow-900/50',
        handle: '!bg-yellow-500'
      };
    case 'email_action':
      return {
        bg: 'bg-purple-100 dark:bg-purple-900/50',
        text: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-300 dark:border-purple-600',
        selectedBorder: 'border-purple-500',
        shadow: 'shadow-purple-200 dark:shadow-purple-900/50',
        handle: '!bg-purple-500'
      };
    case 'user_confirmation':
      return {
        bg: 'bg-cyan-100 dark:bg-cyan-900/50',
        text: 'text-cyan-600 dark:text-cyan-400',
        border: 'border-cyan-300 dark:border-cyan-600',
        selectedBorder: 'border-cyan-500',
        shadow: 'shadow-cyan-200 dark:shadow-cyan-900/50',
        handle: '!bg-cyan-500'
      };
    case 'exit':
      return {
        bg: 'bg-rose-100 dark:bg-rose-900/50',
        text: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-300 dark:border-rose-600',
        selectedBorder: 'border-rose-500',
        shadow: 'shadow-rose-200 dark:shadow-rose-900/50',
        handle: '!bg-rose-500'
      };
    case 'ai_lookup':
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/50',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-300 dark:border-amber-600',
        selectedBorder: 'border-amber-500',
        shadow: 'shadow-amber-200 dark:shadow-amber-900/50',
        handle: '!bg-amber-500'
      };
    default:
      return {
        bg: 'bg-gray-100 dark:bg-gray-700',
        text: 'text-gray-600 dark:text-gray-400',
        border: 'border-gray-300 dark:border-gray-600',
        selectedBorder: 'border-gray-500',
        shadow: 'shadow-gray-200 dark:shadow-gray-900/50',
        handle: '!bg-gray-500'
      };
  }
};

export const WorkflowNode = memo(({ data, selected }: NodeProps<WorkflowNodeData>) => {
  const colors = getWorkflowColor(data.stepType);
  const isBranching = data.stepType === 'conditional_check' || data.stepType === 'branch' || data.stepType === 'user_confirmation';
  const isTerminal = data.stepType === 'exit';

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 min-w-[200px] shadow-md transition-all ${
        selected ? `${colors.selectedBorder} ${colors.shadow}` : colors.border
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`!w-3 !h-3 ${colors.handle} !border-2 !border-white`}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`p-2 ${colors.bg} rounded-lg ${colors.text}`}>
            {getWorkflowIcon(data.stepType)}
          </div>
          <div>
            <div className={`text-xs font-medium ${colors.text} uppercase tracking-wide`}>
              {getWorkflowLabel(data.stepType)}
            </div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{data.label}</div>
          </div>
        </div>
        {(data.onEdit || data.onDelete) && (
          <div className="flex items-center space-x-1 ml-3">
            {data.onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onEdit?.();
                }}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
            {data.onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onDelete?.();
                }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      {isTerminal ? (
        <div className="text-xs mt-2 text-center text-rose-600 dark:text-rose-400 font-medium">
          End of Flow
        </div>
      ) : isBranching ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="success"
            style={{ left: '30%' }}
            className={`!w-3 !h-3 !bg-green-500 !border-2 !border-white`}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="failure"
            style={{ left: '70%' }}
            className={`!w-3 !h-3 !bg-red-500 !border-2 !border-white`}
          />
          <div className="flex justify-between text-xs mt-2 text-gray-500 dark:text-gray-400">
            <span className="text-green-600">Yes</span>
            <span className="text-red-600">No</span>
          </div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className={`!w-3 !h-3 ${colors.handle} !border-2 !border-white`}
        />
      )}
    </div>
  );
});

WorkflowNode.displayName = 'WorkflowNode';

export const nodeTypes = {
  group: GroupNode,
  workflow: WorkflowNode,
};
