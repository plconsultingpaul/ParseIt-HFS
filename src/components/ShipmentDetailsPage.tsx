import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Route, Hash, Box, FileText, Clock, Loader2 } from 'lucide-react';
import type { User, TraceNumbersSectionConfig, TrackTraceTemplateSection } from '../types';
import { supabase } from '../lib/supabase';

interface TraceNumber {
  label: string;
  value: string;
  color: string;
}

interface ShipmentDetailsPageProps {
  currentUser: User | null;
}

export default function ShipmentDetailsPage({ currentUser }: ShipmentDetailsPageProps) {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId');
  const navigate = useNavigate();

  const [traceNumbers, setTraceNumbers] = useState<TraceNumber[]>([]);
  const [traceNumbersLoading, setTraceNumbersLoading] = useState(false);
  const [traceNumbersSection, setTraceNumbersSection] = useState<TrackTraceTemplateSection | null>(null);

  const handleBack = () => {
    if (currentUser?.role === 'client') {
      navigate('/client/track-trace');
    } else {
      navigate('/track-trace');
    }
  };

  useEffect(() => {
    if (templateId && orderId) {
      loadTraceNumbersConfig();
    }
  }, [templateId, orderId]);

  const loadTraceNumbersConfig = async () => {
    if (!templateId) return;

    try {
      const { data: sectionData, error: sectionError } = await supabase
        .from('track_trace_template_sections')
        .select('*')
        .eq('template_id', templateId)
        .eq('section_type', 'trace_numbers')
        .maybeSingle();

      if (sectionError) throw sectionError;

      if (sectionData && sectionData.is_enabled) {
        const section: TrackTraceTemplateSection = {
          id: sectionData.id,
          templateId: sectionData.template_id,
          sectionType: sectionData.section_type,
          displayOrder: sectionData.display_order,
          isEnabled: sectionData.is_enabled,
          config: sectionData.config || {},
          createdAt: sectionData.created_at,
          updatedAt: sectionData.updated_at
        };
        setTraceNumbersSection(section);

        const config = section.config as TraceNumbersSectionConfig;
        if (config.apiSpecEndpointId && config.pathParameterField) {
          await fetchTraceNumbers(config);
        }
      }
    } catch (err) {
      console.error('Failed to load trace numbers config:', err);
    }
  };

  const fetchTraceNumbers = async (config: TraceNumbersSectionConfig) => {
    if (!orderId) return;

    try {
      setTraceNumbersLoading(true);

      const { data: endpointData, error: endpointError } = await supabase
        .from('api_spec_endpoints')
        .select('path, api_spec_id')
        .eq('id', config.apiSpecEndpointId)
        .maybeSingle();

      if (endpointError || !endpointData) {
        console.error('Failed to load endpoint:', endpointError);
        return;
      }

      let baseUrl = '';
      let authToken = '';

      if (config.apiSourceType === 'secondary' && config.secondaryApiId) {
        const { data: secondaryApi } = await supabase
          .from('secondary_api_configs')
          .select('base_url, auth_token')
          .eq('id', config.secondaryApiId)
          .maybeSingle();

        if (secondaryApi) {
          baseUrl = secondaryApi.base_url;
          authToken = secondaryApi.auth_token;
        }
      } else {
        const { data: apiSettings } = await supabase
          .from('api_settings')
          .select('path, password')
          .maybeSingle();

        if (apiSettings) {
          baseUrl = apiSettings.path;
          authToken = apiSettings.password;
        }
      }

      if (!baseUrl) return;

      let apiPath = endpointData.path;
      apiPath = apiPath.replace(/{[^}]+}/g, orderId);

      const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const normalizedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
      const fullUrl = normalizedBase + normalizedPath;

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch trace numbers:', response.status);
        return;
      }

      const data = await response.json();
      const result = Array.isArray(data) ? data[0] : (data.value?.[0] || data.data?.[0] || data);

      const mappedTraceNumbers: TraceNumber[] = (config.fieldMappings || [])
        .map((mapping) => {
          const value = result?.[mapping.valueField] || '';
          if (!value) return null;
          return {
            label: mapping.label,
            value,
            color: mapping.color || 'gray'
          };
        })
        .filter((item): item is TraceNumber => item !== null && item.value !== '');

      setTraceNumbers(mappedTraceNumbers);
    } catch (err) {
      console.error('Failed to fetch trace numbers:', err);
    } finally {
      setTraceNumbersLoading(false);
    }
  };

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700 border-blue-200',
      purple: 'bg-purple-100 text-purple-700 border-purple-200',
      red: 'bg-red-100 text-red-700 border-red-200',
      green: 'bg-green-100 text-green-700 border-green-200',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      orange: 'bg-orange-100 text-orange-700 border-orange-200',
      teal: 'bg-teal-100 text-teal-700 border-teal-200',
      gray: 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return colorMap[color] || colorMap.gray;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-orange-500 hover:text-orange-600 font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Shipments
      </button>

      {/* Summary Section */}
      <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">{orderId || 'Loading...'}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Tracking: —</p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex px-4 py-2 rounded-full border font-semibold bg-slate-100 text-slate-700 border-slate-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
                Loading...
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {['HFS Bill #', 'Total Pieces', 'Total Pallets', 'Total Weight', 'Total Cube', 'Vessel', 'Voyage', 'Commodity'].map((label) => (
            <div key={label}>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">{label}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">—</p>
            </div>
          ))}
        </div>
      </div>

      {/* Shipment Timeline Section */}
      <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shipment Timeline</h2>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Timeline details will be displayed here
        </div>
      </div>

      {/* Route Summary Section */}
      <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
            <Route className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Route Summary</h2>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Route details will be displayed here
        </div>
      </div>

      {/* Trace Numbers Section */}
      {(!traceNumbersSection || traceNumbersSection.isEnabled) && (
        <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
              <Hash className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Trace Numbers</h2>
          </div>

          {traceNumbersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              <span className="ml-2 text-gray-500 dark:text-gray-400">Loading trace numbers...</span>
            </div>
          ) : traceNumbers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {traceNumbers.map((trace, index) => (
                <div
                  key={index}
                  className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                >
                  <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border mb-2 ${getColorClasses(trace.color)}`}>
                    {trace.label}
                  </span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {trace.value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {traceNumbersSection?.config && Object.keys(traceNumbersSection.config).length > 0
                ? 'No trace numbers found for this shipment'
                : 'Trace number details will be displayed here'}
            </div>
          )}
        </div>
      )}

      {/* Barcode Details Section */}
      <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <Box className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Barcode Details</h2>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Barcode details will be displayed here
        </div>
      </div>

      {/* Documents Section */}
      <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Documents</h2>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Document details will be displayed here
        </div>
      </div>
    </div>
  );
}
