import React from 'react';
import { FileText } from 'lucide-react';
import GettingStartedSection from './sections/GettingStartedSection';
import UploadModesSection from './sections/UploadModesSection';
import ExtractionProcessSection from './sections/ExtractionProcessSection';
import SettingsOverviewSection from './sections/SettingsOverviewSection';
import EmailMonitoringSection from './sections/EmailMonitoringSection';
import ExtractionTypesSection from './sections/ExtractionTypesSection';
import TransformationTypesSection from './sections/TransformationTypesSection';
import FieldMappingsSection from './sections/FieldMappingsSection';
import WorkflowsSection from './sections/WorkflowsSection';
import UserManagementSection from './sections/UserManagementSection';
import AdvancedPdfProcessingSection from './sections/AdvancedPdfProcessingSection';
import ConditionalUploadSection from './sections/ConditionalUploadSection';
import CompleteExampleSection from './sections/CompleteExampleSection';
import ConfigurationGuideSection from './sections/ConfigurationGuideSection';
import AdvancedUseCasesSection from './sections/AdvancedUseCasesSection';
import TroubleshootingSection from './sections/TroubleshootingSection';
import BestPracticesSection from './sections/BestPracticesSection';
import ToolsSection from './sections/ToolsSection';
import ApiConfigurationSection from './sections/ApiConfigurationSection';
import SupportSection from './sections/SupportSection';
import EmailActionsSection from './sections/EmailActionsSection';

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-8">
        <div className="text-center">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <FileText className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Parse-It Help Center</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Complete guide to using Parse-It for PDF data extraction
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <GettingStartedSection />
        <UploadModesSection />
        <ExtractionProcessSection />
        <SettingsOverviewSection />
        <EmailMonitoringSection />
        <ExtractionTypesSection />
        <TransformationTypesSection />
        <FieldMappingsSection />
        <WorkflowsSection />
        <UserManagementSection />
        <AdvancedPdfProcessingSection />
        <ConditionalUploadSection />
        <CompleteExampleSection />
        <ConfigurationGuideSection />
        <AdvancedUseCasesSection />
        <BestPracticesSection />
        <TroubleshootingSection />
        <ToolsSection />
        <ApiConfigurationSection />
        <SupportSection />
        <EmailActionsSection />
      </div>
    </div>
  );
}
