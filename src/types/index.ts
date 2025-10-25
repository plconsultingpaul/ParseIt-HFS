export interface FieldMapping {
  fieldName: string;
  type: 'ai' | 'mapped' | 'hardcoded';
  value: string;
  dataType?: 'string' | 'number' | 'integer' | 'datetime' | 'phone' | 'boolean';
  maxLength?: number;
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
}

export interface TransformationFieldMapping {
  fieldName: string;
  type: 'ai' | 'mapped' | 'hardcoded';
  value: string;
  dataType?: 'string' | 'number' | 'integer' | 'datetime' | 'phone' | 'boolean';
  maxLength?: number;
  pageNumberInGroup?: number;
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

export interface ApiConfig {
  id?: string;
  baseUrl: string;
  username: string;
  password: string;
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

export interface User {
  id: string;
  email: string;
  role?: 'admin' | 'user' | 'vendor';
  fullName?: string;
  createdAt?: string;
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

export interface EmailProcessingRule {
  id: string;
  ruleName: string;
  fromAddress?: string;
  subjectContains?: string;
  extractionTypeId?: string;
  transformationTypeId?: string;
  processingMode: 'extraction' | 'transformation';
  isEnabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export type ExtractionWorkflow = Workflow;
