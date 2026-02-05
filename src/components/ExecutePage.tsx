import React, { useState, useEffect, useMemo } from 'react';
import { Play, Loader2, AlertCircle, CheckCircle2, QrCode, X, Download, Link, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import FlowExecutionModal, { ExecuteButtonGroup, ExecuteButtonField, FlowNodeMapping } from './common/FlowExecutionModal';
import type { User } from '../types';

interface ButtonCategory {
  id: string;
  name: string;
  displayOrder: number;
}

interface ExecuteButton {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  categoryIds: string[];
  qrCodeEnabled: boolean;
  qrCodeSlug: string | null;
}

interface ExecutePageProps {
  user?: User | null;
}

interface ExecutionResult {
  success: boolean;
  buttonName?: string;
  message?: string;
  error?: string;
}

interface ModalData {
  groups: ExecuteButtonGroup[];
  fields: ExecuteButtonField[];
  flowNodeMappings: FlowNodeMapping[];
}

export default function ExecutePage({ user }: ExecutePageProps) {
  const [loading, setLoading] = useState(true);
  const [buttons, setButtons] = useState<ExecuteButton[]>([]);
  const [categories, setCategories] = useState<ButtonCategory[]>([]);
  const [allowedCategoryIds, setAllowedCategoryIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedButton, setSelectedButton] = useState<ExecuteButton | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [qrCodeModalButton, setQrCodeModalButton] = useState<ExecuteButton | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      let userAllowedCategoryIds: string[] = [];
      if (user && !user.isAdmin) {
        const { data: accessData, error: accessError } = await supabase
          .from('user_execute_category_access')
          .select('category_id')
          .eq('user_id', user.id);

        if (accessError) throw accessError;
        userAllowedCategoryIds = (accessData || []).map(a => a.category_id);
      }

      const [buttonsRes, categoriesRes, assignmentsRes] = await Promise.all([
        supabase
          .from('execute_buttons')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('execute_button_categories')
          .select('*')
          .order('display_order', { ascending: true }),
        supabase
          .from('execute_button_category_assignments')
          .select('button_id, category_id')
      ]);

      if (buttonsRes.error) throw buttonsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      const assignmentsByButton: Record<string, string[]> = {};
      (assignmentsRes.data || []).forEach((a: any) => {
        if (!assignmentsByButton[a.button_id]) {
          assignmentsByButton[a.button_id] = [];
        }
        assignmentsByButton[a.button_id].push(a.category_id);
      });

      const buttonsData: ExecuteButton[] = (buttonsRes.data || []).map(b => ({
        id: b.id,
        name: b.name,
        description: b.description,
        sortOrder: b.sort_order,
        isActive: b.is_active,
        categoryIds: assignmentsByButton[b.id] || [],
        qrCodeEnabled: b.qr_code_enabled || false,
        qrCodeSlug: b.qr_code_slug || null
      }));

      let filteredCategoriesData: ButtonCategory[] = (categoriesRes.data || []).map(c => ({
        id: c.id,
        name: c.name,
        displayOrder: c.display_order
      }));

      if (user && !user.isAdmin && userAllowedCategoryIds.length > 0) {
        filteredCategoriesData = filteredCategoriesData.filter(c =>
          userAllowedCategoryIds.includes(c.id)
        );
      } else if (user && !user.isAdmin && userAllowedCategoryIds.length === 0) {
        filteredCategoriesData = [];
      }

      setAllowedCategoryIds(user?.isAdmin ? [] : userAllowedCategoryIds);
      setButtons(buttonsData);
      setCategories(filteredCategoriesData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredButtons = useMemo(() => {
    let filtered = buttons;

    if (user && !user.isAdmin && allowedCategoryIds.length > 0) {
      filtered = filtered.filter(b =>
        b.categoryIds.some(catId => allowedCategoryIds.includes(catId))
      );
    } else if (user && !user.isAdmin && allowedCategoryIds.length === 0) {
      return [];
    }

    if (selectedCategoryId) {
      filtered = filtered.filter(b => b.categoryIds.includes(selectedCategoryId));
    }

    return filtered;
  }, [buttons, selectedCategoryId, allowedCategoryIds, user]);

  const handleButtonClick = async (button: ExecuteButton) => {
    setSelectedButton(button);
    setLoadingModal(true);
    setExecutionResult(null);

    try {
      const { data: flowNodes, error: flowError } = await supabase
        .from('execute_button_flow_nodes')
        .select('*')
        .eq('button_id', button.id)
        .eq('node_type', 'group');

      if (flowError) throw flowError;

      const { data: flowEdges, error: edgesError } = await supabase
        .from('execute_button_flow_edges')
        .select('*')
        .eq('button_id', button.id);

      if (edgesError) throw edgesError;

      const groupIds = (flowNodes || [])
        .filter((n: any) => n.group_id)
        .map((n: any) => n.group_id);

      let groups: ExecuteButtonGroup[] = [];
      let fields: ExecuteButtonField[] = [];

      if (groupIds.length > 0) {
        const { data: groupsData, error: groupsError } = await supabase
          .from('execute_button_groups')
          .select('*')
          .in('id', groupIds);

        if (groupsError) throw groupsError;

        const { data: fieldsData, error: fieldsError } = await supabase
          .from('execute_button_fields')
          .select('*')
          .in('group_id', groupIds)
          .order('sort_order', { ascending: true });

        if (fieldsError) throw fieldsError;

        const orderedGroups = sortGroupsByFlow(flowNodes || [], flowEdges || [], groupsData || []);

        groups = orderedGroups.map((g: any) => ({
          id: g.id,
          name: g.name,
          description: g.description || '',
          sortOrder: g.sort_order || 0,
          isArrayGroup: g.is_array_group || false,
          arrayMinRows: g.array_min_rows || 1,
          arrayMaxRows: g.array_max_rows || 10,
          arrayFieldName: g.array_field_name || ''
        }));

        fields = (fieldsData || []).map((f: any) => ({
          id: f.id,
          groupId: f.group_id,
          name: f.name,
          fieldKey: f.field_key,
          fieldType: f.field_type,
          isRequired: f.is_required || false,
          defaultValue: f.default_value,
          options: f.options || [],
          sortOrder: f.sort_order || 0,
          placeholder: f.placeholder,
          helpText: f.help_text,
          maxLength: f.max_length
        }));
      }

      const flowNodeMappings: FlowNodeMapping[] = (flowNodes || [])
        .filter((n: any) => n.group_id)
        .map((n: any) => ({
          nodeId: n.id,
          groupId: n.group_id,
          fieldMappings: n.field_mappings || {},
          headerContent: n.header_content || '',
          displayWithPrevious: n.display_with_previous || false
        }));

      setModalData({ groups, fields, flowNodeMappings });
      setShowModal(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingModal(false);
    }
  };

  const sortGroupsByFlow = (nodes: any[], edges: any[], groups: any[]): any[] => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const groupNodeMap = new Map(nodes.filter(n => n.group_id).map(n => [n.group_id, n]));

    const adjacency = new Map<string, string[]>();
    nodes.forEach(n => adjacency.set(n.id, []));
    edges.forEach(e => {
      if (adjacency.has(e.source_node_id)) {
        adjacency.get(e.source_node_id)!.push(e.target_node_id);
      }
    });

    const inDegree = new Map<string, number>();
    nodes.forEach(n => inDegree.set(n.id, 0));
    edges.forEach(e => {
      if (inDegree.has(e.target_node_id)) {
        inDegree.set(e.target_node_id, (inDegree.get(e.target_node_id) || 0) + 1);
      }
    });

    const queue: string[] = [];
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) queue.push(nodeId);
    });

    const orderedNodeIds: string[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      orderedNodeIds.push(nodeId);
      (adjacency.get(nodeId) || []).forEach(targetId => {
        inDegree.set(targetId, (inDegree.get(targetId) || 1) - 1);
        if (inDegree.get(targetId) === 0) {
          queue.push(targetId);
        }
      });
    }

    const orderedGroups: any[] = [];
    orderedNodeIds.forEach(nodeId => {
      const node = nodeMap.get(nodeId);
      if (node && node.group_id) {
        const group = groups.find(g => g.id === node.group_id);
        if (group && !orderedGroups.includes(group)) {
          orderedGroups.push(group);
        }
      }
    });

    groups.forEach(g => {
      if (!orderedGroups.includes(g)) {
        orderedGroups.push(g);
      }
    });

    return orderedGroups;
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedButton(null);
    setModalData(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadingModal && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center">
          <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3 animate-spin" />
          <p className="text-sm text-blue-700 dark:text-blue-400">Loading button configuration...</p>
        </div>
      )}

      {executionResult && (
        <div className={`rounded-lg p-4 flex items-start ${
          executionResult.success
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          {executionResult.success ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-medium ${
              executionResult.success
                ? 'text-green-800 dark:text-green-300'
                : 'text-red-800 dark:text-red-300'
            }`}>
              {executionResult.buttonName}
            </p>
            <p className={`text-sm ${
              executionResult.success
                ? 'text-green-700 dark:text-green-400'
                : 'text-red-700 dark:text-red-400'
            }`}>
              {executionResult.success ? executionResult.message : executionResult.error}
            </p>
          </div>
          <button
            onClick={() => setExecutionResult(null)}
            className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedCategoryId === null
                ? 'bg-blue-600 text-white'
                : 'bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategoryId(category.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategoryId === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {filteredButtons.length === 0 ? (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Play className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {selectedCategoryId ? 'No Buttons in This Category' : 'No Execute Buttons Available'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {selectedCategoryId
              ? 'Select a different category or click "All" to see all buttons.'
              : 'Configure execute buttons in Type Setup to see them here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredButtons.map(button => (
            <div
              key={button.id}
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 group"
            >
              <div className="flex items-start space-x-4">
                <button
                  onClick={() => handleButtonClick(button)}
                  className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-lg group-hover:scale-105 transition-transform flex-shrink-0"
                >
                  <Play className="h-6 w-6 text-white" />
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => handleButtonClick(button)}
                    className="text-left w-full"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {button.name}
                    </h3>
                    {button.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {button.description}
                      </p>
                    )}
                  </button>
                </div>
                {button.qrCodeEnabled && button.qrCodeSlug && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setQrCodeModalButton(button);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                    title="View QR Code"
                  >
                    <QrCode className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && selectedButton && modalData && (
        <FlowExecutionModal
          buttonId={selectedButton.id}
          buttonName={selectedButton.name}
          groups={modalData.groups}
          fields={modalData.fields}
          flowNodeMappings={modalData.flowNodeMappings}
          onClose={handleCloseModal}
          userId={user?.id}
        />
      )}

      {qrCodeModalButton && qrCodeModalButton.qrCodeSlug && (
        <QrCodeModal
          buttonName={qrCodeModalButton.name}
          slug={qrCodeModalButton.qrCodeSlug}
          onClose={() => setQrCodeModalButton(null)}
        />
      )}
    </div>
  );
}

function QrCodeModal({ buttonName, slug, onClose }: { buttonName: string; slug: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const baseUrl = window.location.origin;
  const executeUrl = `${baseUrl}/execute/${slug}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(executeUrl)}`;
  const qrCodeDownloadUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=png&data=${encodeURIComponent(executeUrl)}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(executeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = executeUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const response = await fetch(qrCodeDownloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeButtonName = buttonName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      link.download = `qr-code-${safeButtonName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download QR code:', err);
    } finally {
      setDownloading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            QR Code - {buttonName}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-200">
              <img src={qrCodeUrl} alt="QR Code" className="w-[250px] h-[250px]" />
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
            Scan this code with your phone to open the flow directly
          </p>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
              {executeUrl}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCopyUrl}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Link className="h-4 w-4" />
                  Copy URL
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
