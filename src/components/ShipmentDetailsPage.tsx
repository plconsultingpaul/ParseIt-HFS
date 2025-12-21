import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Route, Hash, Box, FileText, Clock } from 'lucide-react';
import type { User } from '../types';

interface ShipmentDetailsPageProps {
  currentUser: User | null;
}

export default function ShipmentDetailsPage({ currentUser }: ShipmentDetailsPageProps) {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const handleBack = () => {
    if (currentUser?.role === 'client') {
      navigate('/client/track-trace');
    } else {
      navigate('/track-trace');
    }
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
      <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white/90 via-slate-50/40 to-white/80 dark:from-gray-800/90 dark:via-gray-800/40 dark:to-gray-800/80 backdrop-blur-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
            <Hash className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Trace Numbers</h2>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Trace number details will be displayed here
        </div>
      </div>

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
