import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Route, Hash, Box, FileText, Clock, Loader2 } from 'lucide-react';
import type { User, TraceNumbersSectionConfig, TrackTraceTemplateSection } from '../types';
import { supabase } from '../lib/supabase';

interface TraceNumberCard {
  headerLabel: string;
  headerValue: string;
  headerColor: string;
  detailLabel: string;
  detailValue: string;
}

interface ShipmentDetailsPageProps {
  currentUser: User | null;
}

export default function ShipmentDetailsPage({ currentUser }: ShipmentDetailsPageProps) {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId');
  const navigate = useNavigate();

  console.log('[ShipmentDetailsPage] Component loaded:', {
    orderId,
    templateId,
    currentUser: currentUser?.username,
    role: currentUser?.role
  });

  const [traceNumbers, setTraceNumbers] = useState<TraceNumberCard[]>([]);
  const [traceNumbersLoading, setTraceNumbersLoading] = useState(false);
  const [traceNumbersSection, setTraceNumbersSection] = useState<TrackTraceTemplateSection | null>(null);
  const [enabledSections, setEnabledSections] = useState<TrackTraceTemplateSection[]>([]);

  const handleBack = () => {
    if (currentUser?.role === 'client') {
      navigate('/client/track-trace');
    } else {
      navigate('/track-trace');
    }
  };

  useEffect(() => {
    console.log('[ShipmentDetailsPage] useEffect triggered:', { templateId, orderId });
    if (templateId && orderId) {
      console.log('[ShipmentDetailsPage] Calling loadTemplateSections...');
      loadTemplateSections();
    } else {
      console.log('[ShipmentDetailsPage] Missing templateId or orderId - not loading sections');
    }
  }, [templateId, orderId]);

  const loadTemplateSections = async () => {
    if (!templateId) {
      console.log('[ShipmentDetailsPage] loadTemplateSections called but no templateId');
      return;
    }

    console.log('[ShipmentDetailsPage] Loading template sections for templateId:', templateId);

    try {
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('track_trace_template_sections')
        .select('*')
        .eq('template_id', templateId)
        .eq('is_enabled', true)
        .order('display_order');

      console.log('[ShipmentDetailsPage] Sections query result:', {
        sectionsData,
        error: sectionsError,
        count: sectionsData?.length
      });

      if (sectionsError) throw sectionsError;

      const mappedSections: TrackTraceTemplateSection[] = (sectionsData || []).map((s: any) => ({
        id: s.id,
        templateId: s.template_id,
        sectionType: s.section_type,
        displayOrder: s.display_order,
        isEnabled: s.is_enabled,
        config: s.config || {},
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }));

      console.log('[ShipmentDetailsPage] Mapped sections:', mappedSections.map(s => s.sectionType));
      setEnabledSections(mappedSections);

      const traceNumbersSection = mappedSections.find(s => s.sectionType === 'trace_numbers');
      if (traceNumbersSection) {
        console.log('[ShipmentDetailsPage] Found trace numbers section:', traceNumbersSection);
        setTraceNumbersSection(traceNumbersSection);
        const config = traceNumbersSection.config as TraceNumbersSectionConfig;
        console.log('[ShipmentDetailsPage] Trace numbers config:', config);
        if (config.apiSpecEndpointId && config.fieldMappings && config.fieldMappings.length > 0) {
          console.log('[ShipmentDetailsPage] Fetching trace numbers...');
          await fetchTraceNumbers(config);
        } else {
          console.log('[ShipmentDetailsPage] Not fetching trace numbers:', {
            hasEndpoint: !!config.apiSpecEndpointId,
            hasFieldMappings: !!config.fieldMappings,
            mappingsLength: config.fieldMappings?.length
          });
        }
      } else {
        console.log('[ShipmentDetailsPage] No trace numbers section found');
      }
    } catch (err) {
      console.error('[ShipmentDetailsPage] Failed to load template sections:', err);
    }
  };

  const fetchTraceNumbers = async (config: TraceNumbersSectionConfig) => {
    if (!orderId) {
      console.log('[ShipmentDetailsPage] fetchTraceNumbers called but no orderId');
      return;
    }

    console.log('[ShipmentDetailsPage] fetchTraceNumbers called with config:', config);

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

      let apiPath = endpointData.path;
      apiPath = apiPath.replace(/{[^}]+}/g, orderId);

      console.log('[ShipmentDetailsPage] Calling proxy with apiPath:', apiPath);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const proxyResponse = await fetch(`${supabaseUrl}/functions/v1/track-trace-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          apiSourceType: config.apiSourceType || 'main',
          secondaryApiId: config.secondaryApiId || '',
          apiPath,
          httpMethod: 'GET',
          queryString: ''
        })
      });

      if (!proxyResponse.ok) {
        console.error('Failed to fetch trace numbers:', proxyResponse.status);
        return;
      }

      const data = await proxyResponse.json();
      console.log('[ShipmentDetailsPage] Raw proxy response:', JSON.stringify(data, null, 2));

      const traceNumbersArray = data.traceNumbers || [];
      console.log('[ShipmentDetailsPage] Trace numbers array:', traceNumbersArray);

      const fieldMappings = config.fieldMappings || [];
      const headerMapping = fieldMappings.find(m => m.displayType === 'header');
      const detailMapping = fieldMappings.find(m => m.displayType === 'detail' || !m.displayType);

      const mappedTraceNumbers: TraceNumberCard[] = [];
      const hasHeaderValueMappings = headerMapping && headerMapping.valueMappings && headerMapping.valueMappings.length > 0;

      for (const traceItem of traceNumbersArray) {
        const rawHeaderValue = headerMapping ? (traceItem?.[headerMapping.valueField] || '') : '';
        let headerValue = rawHeaderValue;
        let headerColor = 'gray';
        let headerLabel = headerMapping?.label || '';
        let headerMappingFound = false;

        if (headerMapping && rawHeaderValue && headerMapping.valueMappings?.length > 0) {
          const matchedMapping = headerMapping.valueMappings.find(
            vm => vm.sourceValue === rawHeaderValue || vm.sourceValue === String(rawHeaderValue)
          );
          if (matchedMapping) {
            headerValue = matchedMapping.displayValue;
            headerColor = matchedMapping.color || 'gray';
            headerMappingFound = true;
          }
        }

        if (hasHeaderValueMappings && !headerMappingFound) {
          continue;
        }

        const detailValue = detailMapping ? (traceItem?.[detailMapping.valueField] || '') : '';
        const detailLabel = detailMapping?.label || '';

        if (headerValue || detailValue) {
          mappedTraceNumbers.push({
            headerLabel,
            headerValue,
            headerColor,
            detailLabel,
            detailValue
          });
        }
      }

      console.log('[ShipmentDetailsPage] Mapped trace numbers:', mappedTraceNumbers);
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

  const renderSection = (section: TrackTraceTemplateSection) => {
    switch (section.sectionType) {
      case 'shipment_summary':
        return (
          <div key={section.id} className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
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
        );

      case 'shipment_timeline':
        return (
          <div key={section.id} className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
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
        );

      case 'route_summary':
        return (
          <div key={section.id} className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
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
        );

      case 'trace_numbers':
        return (
          <div key={section.id} className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
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
                    {trace.headerValue && (
                      <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border mb-2 ${getColorClasses(trace.headerColor)}`}>
                        {trace.headerValue}
                      </span>
                    )}
                    {trace.detailLabel && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{trace.detailLabel}</p>
                    )}
                    {trace.detailValue && (
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {trace.detailValue}
                      </p>
                    )}
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
        );

      case 'barcode_details':
        return (
          <div key={section.id} className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
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
        );

      case 'documents':
        return (
          <div key={section.id} className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
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
        );

      default:
        return null;
    }
  };

  console.log('[ShipmentDetailsPage] Rendering with enabledSections:', enabledSections.length, enabledSections.map(s => s.sectionType));

  return (
    <div className="space-y-8 animate-fade-in">
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-orange-500 hover:text-orange-600 font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Shipments
      </button>

      {enabledSections.map(section => renderSection(section))}
    </div>
  );
}
