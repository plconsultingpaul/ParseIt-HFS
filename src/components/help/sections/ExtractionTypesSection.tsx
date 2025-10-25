import React from 'react';
import { FileText } from 'lucide-react';
import SectionCard from '../shared/SectionCard';
import SectionHeader from '../shared/SectionHeader';

export default function ExtractionTypesSection() {
  return (
    <SectionCard>
      <SectionHeader
        icon={FileText}
        title="Extraction Types"
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
      />
      <div className="space-y-6">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="font-semibold text-purple-800 mb-4">Creating Extraction Types</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-purple-800 mb-3">Required Fields:</h4>
              <ul className="text-purple-700 space-y-2">
                <li>• <strong>Name:</strong> Descriptive name for the extraction type</li>
                <li>• <strong>Default Instructions:</strong> Tell the AI what data to extract</li>
                <li>• <strong>Template:</strong> XML or JSON structure for output format</li>
                <li>• <strong>Filename:</strong> Base name for generated files</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-purple-800 mb-3">Optional Features:</h4>
              <ul className="text-purple-700 space-y-2">
                <li>• <strong>Field Mappings:</strong> Map specific PDF coordinates to JSON fields</li>
                <li>• <strong>ParseIt ID Mapping:</strong> Automatically inject unique IDs</li>
                <li>• <strong>Auto-Detection:</strong> Instructions for AI to identify document type</li>
                <li>• <strong>Workflow Assignment:</strong> Link to multi-step processing workflows</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="font-semibold text-amber-800 mb-3">XML vs JSON Formats</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-amber-800 mb-2">XML Format:</h4>
              <ul className="text-amber-700 space-y-2">
                <li>• Files uploaded to SFTP server</li>
                <li>• Use {'{{'} PARSEIT_ID_PLACEHOLDER {'}}'} in templates</li>
                <li>• Best for legacy systems</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-amber-800 mb-2">JSON Format:</h4>
              <ul className="text-amber-700 space-y-2">
                <li>• Data sent to API endpoints</li>
                <li>• Advanced field mapping capabilities</li>
                <li>• Modern REST API integration</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
