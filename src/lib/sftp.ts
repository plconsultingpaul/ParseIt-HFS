import type { SftpConfig } from '../types';

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
}

export async function uploadToSftp({
  sftpConfig,
  xmlContent,
  pdfFile,
  baseFilename,
  parseitIdMapping,
  useExistingParseitId,
  userId,
  extractionTypeId,
  formatType
}: SftpUploadOptions): Promise<void> {
  try {
    // Convert PDF file to base64
    const pdfBase64 = await fileToBase64(pdfFile);
    
    // Get the Supabase URL from environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    // Call the Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/sftp-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        sftpConfig,
        xmlContent,
        pdfBase64,
        baseFilename,
        originalFilename: pdfFile.name,
        parseitIdMapping,
        useExistingParseitId,
        userId,
        extractionTypeId,
        formatType
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'SFTP upload failed');
    }

    const result = await response.json();
    console.log('SFTP upload successful:', result);
    
  } catch (error) {
    console.error('SFTP upload error:', error);
    throw error;
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64 data
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}