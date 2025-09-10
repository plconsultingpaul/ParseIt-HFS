export interface ExtractionType {
  id: string;
  name: string;
  defaultInstructions: string;
  formatTemplate: string;
  filename: string;
  formatType?: 'XML' | 'JSON';
  jsonPath?: string;
  fieldMappings?: FieldMapping[];
  parseitIdMapping?: string;
  traceTypeMapping?: string;
  traceTypeValue?: string;
  workflowId?: string;
  autoDetectInstructions?: string;
}

export interface FieldMapping {
  fieldName: string;
  type: 'ai' | 'mapped' | 'hardcoded';
  value: string;
  dataType?: 'string' | 'number' | 'integer' | 'datetime';
  maxLength?: number;
  sourceJsonPath?: string;
}

export interface SftpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  xmlPath: string;
  pdfPath: string;
  jsonPath: string;
}

export interface SettingsConfig {
  geminiApiKey: string;
}

export interface ApiConfig {
  path: string;
  password: string;
  googleApiKey: string;
}

export interface EmailMonitoringConfig {
  provider?: 'office365' | 'gmail';
  tenantId: string;
  clientId: string;
  clientSecret: string;
  monitoredEmail: string;
  gmailClientId?: string;
  gmailClientSecret?: string;
  gmailRefreshToken?: string;
  gmailMonitoredLabel?: string;
  pollingInterval: number;
  isEnabled: boolean;
  enableAutoDetect?: boolean;
  lastCheck?: string;
}

export interface EmailProcessingRule {
  id: string;
  ruleName: string;
  senderPattern: string;
  subjectPattern: string;
  extractionTypeId: string;
  isEnabled: boolean;
  priority: number;
}

export interface ProcessedEmail {
  id: string;
  emailId: string;
  sender: string;
  subject: string;
  receivedDate: string;
  processingRuleId?: string;
  extractionTypeId?: string;
  pdfFilename?: string;
  processingStatus: string;
  errorMessage?: string;
  parseitId?: number;
  processedAt?: string;
}

export interface ExtractionLog {
  id: string;
  userId: string | null;
  extractionTypeId: string | null;
  pdfFilename: string;
  pdfPages: number;
  extractionStatus: 'success' | 'failed';
  errorMessage?: string | null;
  createdAt: string;
  apiResponse?: string | null;
  apiStatusCode?: number | null;
  apiError?: string | null;
  extractedData?: string | null;
}

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  isActive: boolean;
  permissions: UserPermissions;
  preferredUploadMode?: 'manual' | 'auto';
}

export interface UserPermissions {
  extractionTypes: boolean;
  sftp: boolean;
  api: boolean;
  emailMonitoring: boolean;
  emailRules: boolean;
  processedEmails: boolean;
  extractionLogs: boolean;
  userManagement: boolean;
  workflowManagement: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface ApiError {
  statusCode: number;
  statusText: string;
  details: any;
  url?: string;
  headers?: Record<string, string>;
}

export interface PageProcessingState {
  isProcessing: boolean;
  isExtracting: boolean;
  extractedData: string;
  extractionError: string;
  apiResponse: string;
  apiError: ApiError | null;
  success: boolean;
  workflowExecutionLogId?: string;
  workflowExecutionLog?: WorkflowExecutionLog | null;
}

export interface DetectionResult {
  detectedTypeId: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  reasoning?: string;
}

export interface ExtractionWorkflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  stepOrder: number;
  stepType: 'api_call' | 'conditional_check' | 'data_transform' | 'sftp_upload';
  stepName: string;
  configJson: ApiCallConfig | ConditionalCheckConfig | DataTransformConfig | SftpUploadConfig;
  nextStepOnSuccessId?: string;
  nextStepOnFailureId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiCallConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  requestBody?: string;
  responseDataPath?: string;
  updateJsonPath?: string;
}

export interface ConditionalCheckConfig {
  jsonPath: string;
  conditionType: 'is_null' | 'is_not_null' | 'equals' | 'contains' | 'greater_than' | 'less_than';
  expectedValue?: string;
}

export interface DataTransformConfig {
  transformations: Array<{
    jsonPath: string;
    operation: 'set_value' | 'copy_from' | 'append' | 'remove' | 'format_phone_us';
    value?: string;
    sourceJsonPath?: string;
  }>;
}

export interface SftpUploadConfig {
  useApiResponseForFilename: boolean;
  filenameSourcePath?: string;
  fallbackFilename?: string;
}

export interface WorkflowExecutionLog {
  id: string;
  extractionLogId?: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStepId?: string;
  currentStepName?: string;
  errorMessage?: string;
  contextData?: any;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface SecuritySettings {
  id: string;
  defaultUploadMode: 'manual' | 'auto';
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailPollingLog {
  id: string;
  timestamp: string;
  provider: string;
  status: string;
  emailsFound: number;
  emailsProcessed: number;
  errorMessage?: string;
  executionTimeMs?: number;
  createdAt: string;
}

export interface SftpUploadOptions {
  sftpConfig: SftpConfig;
  xmlContent: string;
  pdfFile: File;
  baseFilename: string;
  parseitIdMapping?: string;
  useExistingParseitId?: number;
  userId?: string;
  extractionTypeId?: string;
  formatType?: string;
  customFilenamePart?: string;
}