export interface FieldMapping {
  fieldName: string;
  type: 'ai' | 'mapped' | 'hardcoded';
  value: string;
  dataType?: 'string' | 'number' | 'integer' | 'datetime' | 'phone' | 'boolean';
  maxLength?: number;
}

export interface ArraySplitConfig {
  id?: string;
  extractionTypeId?: string;
  targetArrayField: string;
  splitBasedOnField: string;
  splitStrategy: 'one_per_entry' | 'divide_evenly';
  createdAt?: string;
  updatedAt?: string;
}

export interface ExtractionType {
  id: string;
  name: string;
  defaultInstructions: string;
  formatTemplate: string;
  filename: string;
  formatType: 'XML' | 'JSON' | 'CSV';
  jsonPath?: string;
  fieldMappings?: FieldMapping[];
  parseitIdMapping?: string;
  traceTypeMapping?: string;
  traceTypeValue?: string;
  workflowId?: string;
  autoDetectInstructions?: string;
  csvDelimiter?: string;
  csvIncludeHeaders?: boolean;
  csvRowDetectionInstructions?: string;
  csvMultiPageProcessing?: boolean;
  defaultUploadMode?: 'manual' | 'auto';
  lockUploadMode?: boolean;
  arraySplitConfigs?: ArraySplitConfig[];
}

export interface TransformationFieldMapping {
  fieldName: string;
  type: 'ai' | 'mapped' | 'hardcoded';
  value: string;
  dataType?: 'string' | 'number' | 'integer' | 'datetime' | 'phone' | 'boolean';
  maxLength?: number;
  pageNumberInGroup?: number;
}

export interface PageGroupConfig {
  id: string;
  transformationTypeId: string;
  groupOrder: number;
  pagesPerGroup: number;
  workflowId?: string;
  smartDetectionPattern?: string;
  processMode: 'single' | 'all';
  filenameTemplate?: string;
  fieldMappings?: TransformationFieldMapping[];
  useAiDetection?: boolean;
  fallbackBehavior?: 'skip' | 'fixed_position' | 'error';
  detectionConfidenceThreshold?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ManualGroupEdit {
  groupIndex: number;
  groupOrder: number;
  pages: number[];
  pageGroupConfig: PageGroupConfig;
}

export interface TransformationType {
  id: string;
  name: string;
  defaultInstructions: string;
  filenameTemplate: string;
  fieldMappings?: TransformationFieldMapping[];
  autoDetectInstructions?: string;
  workflowId?: string;
  defaultUploadMode?: 'manual' | 'auto';
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  pagesPerGroup?: number;
  documentStartPattern?: string;
  documentStartDetectionEnabled?: boolean;
  pageGroupConfigs?: PageGroupConfig[];
  lockUploadMode?: boolean;
}

export interface SftpConfig {
  id?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  xmlPath: string;
  pdfPath: string;
  jsonPath: string;
  csvPath?: string;
}

export interface OrderDisplayMapping {
  fieldName: string;
  displayLabel: string;
}

export interface ApiConfig {
  id?: string;
  path: string;
  password: string;
  googleApiKey: string;
  orderDisplayFields: string;
  customOrderDisplayFields: OrderDisplayMapping[];
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  stepOrder: number;
  stepType: 'api_call' | 'data_transform' | 'sftp_upload' | 'conditional_check' | 'email_action' | 'rename_pdf';
  stepName: string;
  configJson: any;
  nextStepOnSuccessId?: string;
  nextStepOnFailureId?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  steps?: WorkflowStep[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PageRangeInfo {
  groupOrder: number;
  startPage: number;
  endPage: number;
  groupName?: string;
}

export interface ExtractionLog {
  id: string;
  userId?: string;
  extractionTypeId?: string;
  transformationTypeId?: string;
  pdfFilename: string;
  pdfPages: number;
  extractionStatus: 'success' | 'failed';
  errorMessage?: string;
  extractedData?: string;
  processingMode?: 'extraction' | 'transformation';
  parseitId?: number;
  createdAt: string;
  pageStart?: number;
  pageEnd?: number;
  pageRanges?: PageRangeInfo[];
  unusedPages?: number;
}

export interface WorkflowExecutionLog {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  currentStepId?: string;
  currentStepName?: string;
  errorMessage?: string;
  contextData?: any;
  createdAt: string;
  completedAt?: string;
}

export interface DetectionResult {
  detectedTypeId: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  reasoning: string;
  isVendorRule?: boolean;
  detectedRuleId?: string;
}

export interface VendorExtractionRule {
  id: string;
  vendorId: string;
  ruleName: string;
  autoDetectInstructions: string;
  extractionTypeId?: string;
  transformationTypeId?: string;
  processingMode: 'extraction' | 'transformation';
  priority: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPermissions {
  extractionTypes: boolean;
  transformationTypes: boolean;
  sftp: boolean;
  api: boolean;
  emailMonitoring: boolean;
  emailRules: boolean;
  processedEmails: boolean;
  extractionLogs: boolean;
  userManagement: boolean;
  workflowManagement: boolean;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  isAdmin: boolean;
  isActive: boolean;
  role: 'admin' | 'user' | 'vendor' | 'client';
  permissions: UserPermissions;
  preferredUploadMode: 'manual' | 'auto';
  currentZone?: string;
  clientId?: string;
  isClientAdmin?: boolean;
  hasOrderEntryAccess?: boolean;
  hasRateQuoteAccess?: boolean;
  hasAddressBookAccess?: boolean;
  createdAt?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface EmailConfig {
  id?: string;
  provider: 'office365' | 'gmail';
  office365TenantId?: string;
  office365ClientId?: string;
  office365ClientSecret?: string;
  office365SendFromEmail?: string;
  gmailClientId?: string;
  gmailClientSecret?: string;
  gmailRefreshToken?: string;
  gmailSendFromEmail?: string;
}

export interface EmailMonitoringConfig {
  provider: 'office365' | 'gmail';
  tenantId: string;
  clientId: string;
  clientSecret: string;
  monitoredEmail: string;
  defaultSendFromEmail: string;
  gmailClientId: string;
  gmailClientSecret: string;
  gmailRefreshToken: string;
  gmailMonitoredLabel: string;
  pollingInterval: number;
  isEnabled: boolean;
  enableAutoDetect: boolean;
  lastCheck?: string;
}

export interface EmailProcessingRule {
  id: string;
  ruleName: string;
  senderPattern?: string;
  subjectPattern?: string;
  extractionTypeId?: string;
  transformationTypeId?: string;
  processingMode: 'extraction' | 'transformation';
  isEnabled: boolean;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ExtractionWorkflow = Workflow;

export interface DriverCheckin {
  id: string;
  phoneNumber: string;
  name: string;
  company: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriverCheckinLog {
  id: string;
  driverCheckinId?: string;
  phoneNumber: string;
  name: string;
  company: string;
  bolsCount: number;
  doorNumber: number;
  checkInTimestamp: string;
  status: 'pending' | 'scanning' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export interface DriverCheckinDocument {
  id: string;
  driverCheckinLogId: string;
  pdfFilename: string;
  pdfStoragePath: string;
  documentOrder: number;
  extractionTypeId?: string;
  workflowId?: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  extractionLogId?: string;
  createdAt: string;
}

export interface DriverCheckinSettings {
  id: string;
  fallbackWorkflowId?: string;
  additionalFields: any[];
  isEnabled: boolean;
  baseUrl?: string;
  darkModeEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsConfig {
  id?: string;
  password: string;
  geminiApiKey?: string;
}

export interface FeatureFlag {
  id: string;
  featureKey: string;
  featureName: string;
  isEnabled: boolean;
  description: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlags {
  extractionTypes: boolean;
  transformationTypes: boolean;
  sftpUpload: boolean;
  sftpPolling: boolean;
  apiIntegration: boolean;
  emailMonitoring: boolean;
  emailRules: boolean;
  workflowManagement: boolean;
  userManagement: boolean;
  vendorManagement: boolean;
  driverCheckin: boolean;
  companyBranding: boolean;
  extractionLogs: boolean;
  workflowExecutionLogs: boolean;
  emailPollingLogs: boolean;
  sftpPollingLogs: boolean;
}

export interface UserExtractionType {
  id: string;
  userId: string;
  extractionTypeId: string;
  createdAt: string;
}

export interface Client {
  id: string;
  clientName: string;
  clientId: string;
  isActive: boolean;
  hasOrderEntryAccess: boolean;
  hasRateQuoteAccess: boolean;
  hasAddressBookAccess: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientAddress {
  id: string;
  clientId: string;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  stateProv: string;
  country: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactPhoneExt?: string;
  appointmentReq: boolean;
  active: boolean;
  isShipper: boolean;
  isConsignee: boolean;
  createdAt: string;
  updatedAt: string;
}
