export interface FieldMapping {
  fieldName: string;
  type: 'ai' | 'mapped' | 'hardcoded';
  value: string;
  dataType?: 'string' | 'number' | 'integer' | 'datetime' | 'phone' | 'boolean';
  maxLength?: number;
  removeIfNull?: boolean;
  isWorkflowOnly?: boolean;
}

export interface ArraySplitConfig {
  id?: string;
  extractionTypeId?: string;
  targetArrayField: string;
  splitBasedOnField: string;
  splitStrategy: 'one_per_entry' | 'divide_evenly';
  defaultToOneIfMissing?: boolean;
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
  jsonMultiPageProcessing?: boolean;
  defaultUploadMode?: 'manual' | 'auto';
  lockUploadMode?: boolean;
  arraySplitConfigs?: ArraySplitConfig[];
  pageProcessingMode?: 'all' | 'single' | 'range';
  pageProcessingSinglePage?: number;
  pageProcessingRangeStart?: number;
  pageProcessingRangeEnd?: number;
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
  followsPreviousGroup?: boolean;
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

export interface SecondaryApiConfig {
  id?: string;
  name: string;
  baseUrl: string;
  authToken: string;
  description: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  stepOrder: number;
  stepType: 'api_call' | 'api_endpoint' | 'data_transform' | 'sftp_upload' | 'conditional_check' | 'email_action' | 'rename_pdf';
  stepName: string;
  configJson: any;
  nextStepOnSuccessId?: string;
  nextStepOnFailureId?: string;
  escapeSingleQuotesInBody?: boolean;
}

export interface ApiEndpointStepConfig {
  apiSourceType: 'main' | 'secondary';
  apiEndpointId?: string;
  secondaryApiId?: string;
  httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  apiSpecEndpointId?: string;
  apiPath: string;
  queryParameterConfig: Record<string, { enabled: boolean; value: string }>;
  pathVariables?: Record<string, string>;
  responsePath?: string;
  updateJsonPath?: string;
  manualApiEntry?: boolean;
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

export interface ApiSpec {
  id: string;
  api_endpoint_id?: string;
  secondary_api_id?: string;
  name: string;
  file_name: string;
  spec_content: any;
  version: string;
  description: string;
  uploaded_at: string;
  updated_at: string;
}

export interface ApiSpecEndpoint {
  id: string;
  api_spec_id: string;
  path: string;
  method: string;
  summary: string;
  parameters: any[];
  request_body?: any;
  responses: any;
  created_at: string;
}

export interface ApiEndpointField {
  id: string;
  api_spec_endpoint_id: string;
  field_name: string;
  field_path: string;
  field_type: string;
  is_required: boolean;
  description: string;
  example?: string;
  format?: string;
  parent_field_id?: string;
  created_at: string;
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

export type OrderEntryFieldType = 'text' | 'number' | 'date' | 'datetime' | 'phone' | 'dropdown' | 'file' | 'boolean' | 'zip' | 'postal_code' | 'province' | 'state';

export interface OrderEntryConfig {
  id: string;
  apiEndpoint: string;
  apiMethod: string;
  apiHeaders: Record<string, string>;
  apiAuthType: string;
  apiAuthToken: string;
  workflowId?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderEntryJsonSchema {
  id: string;
  schemaName: string;
  schemaVersion: string;
  schemaContent: any;
  fieldPaths: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderEntryFieldGroup {
  id: string;
  groupName: string;
  groupOrder: number;
  description: string;
  isCollapsible: boolean;
  isExpandedByDefault: boolean;
  backgroundColor: string;
  borderColor: string;
  isArrayGroup: boolean;
  arrayMinRows: number;
  arrayMaxRows: number;
  arrayJsonPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderEntryField {
  id: string;
  fieldGroupId: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: OrderEntryFieldType;
  placeholder: string;
  helpText: string;
  isRequired: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  defaultValue: string;
  dropdownOptions: string[];
  jsonPath: string;
  isArrayField: boolean;
  arrayMinRows: number;
  arrayMaxRows: number;
  aiExtractionInstructions: string;
  validationRegex: string;
  validationErrorMessage: string;
  fieldOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderEntryFieldLayout {
  id: string;
  fieldId: string;
  rowIndex: number;
  columnIndex: number;
  widthColumns: number;
  mobileWidthColumns: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderEntryPdf {
  id: string;
  userId: string;
  originalFilename: string;
  storagePath: string;
  fileSize: number;
  pageCount: number;
  extractionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  extractedData: Record<string, any>;
  extractionConfidence: Record<string, number>;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderEntrySubmission {
  id: string;
  userId: string;
  pdfId?: string;
  submissionData: Record<string, any>;
  apiResponse: Record<string, any>;
  apiStatusCode?: number;
  workflowExecutionLogId?: string;
  submissionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRegistrationToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  isUsed: boolean;
  usedAt?: string;
  createdAt: string;
}

export interface PdfExtractionResult {
  success: boolean;
  fieldData: Record<string, any>;
  confidence: Record<string, number>;
  errorMessage?: string;
}

export interface OrderEntryFormData {
  [key: string]: any;
}

export interface CompanyBranding {
  id: string;
  companyName: string;
  logoUrl: string;
  logoStoragePath?: string;
  showCompanyName: boolean;
}

export interface ApiError {
  statusCode: number;
  statusText: string;
  details: any;
  url: string;
  headers: Record<string, string>;
}

export interface PageProcessingState {
  isProcessing: boolean;
  isExtracting: boolean;
  extractedData: string;
  workflowOnlyData?: string;
  extractionError: string;
  apiResponse: string;
  apiError: ApiError | null;
  success: boolean;
  workflowExecutionLogId?: string;
  workflowExecutionLog?: WorkflowExecutionLog | null;
}
