import type { ApiError, ExtractionType, ApiConfig } from '../types';

export async function sendToApi(
  jsonData: string,
  currentExtractionType: ExtractionType,
  apiConfig: ApiConfig
): Promise<any> {
  if (!currentExtractionType?.jsonPath || !apiConfig.path) {
    throw new Error('API configuration incomplete');
  }

  const apiUrl = apiConfig.path.endsWith('/') 
    ? `${apiConfig.path.slice(0, -1)}${currentExtractionType.jsonPath}`
    : `${apiConfig.path}${currentExtractionType.jsonPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiConfig.password) {
    headers['Authorization'] = `Bearer ${apiConfig.password}`;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: jsonData
  });

  if (!response.ok) {
    let details: any;
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        details = await response.json();
      } else {
        details = await response.text();
      }
    } catch (parseError) {
      details = 'Unable to parse response body';
    }

    const apiError: ApiError = {
      statusCode: response.status,
      statusText: response.statusText,
      details,
      url: apiUrl,
      headers: Object.fromEntries(response.headers.entries())
    };

    throw apiError;
  }

  const responseData = await response.json();
  return responseData;
}