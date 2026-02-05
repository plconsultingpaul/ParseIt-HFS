import React, { useEffect, useState } from 'react';
import { CheckCircle2, X, FileText, Clock, Zap, Hash } from 'lucide-react';

interface SubmissionSuccessModalProps {
  isOpen: boolean;
  submissionId: string;
  apiResponse: any;
  workflowExecutionId?: string;
  onClose: () => void;
  onSubmitAnother: () => void;
}

function getBillNumber(apiResponse: any): string | null {
  if (!apiResponse) return null;

  try {
    if (apiResponse.billNumber) return apiResponse.billNumber;
    if (apiResponse.orders && Array.isArray(apiResponse.orders) && apiResponse.orders.length > 0) {
      if (apiResponse.orders[0].billNumber) return apiResponse.orders[0].billNumber;
    }
    if (apiResponse.data?.orders && Array.isArray(apiResponse.data.orders) && apiResponse.data.orders.length > 0) {
      if (apiResponse.data.orders[0].billNumber) return apiResponse.data.orders[0].billNumber;
    }
    if (apiResponse.result?.billNumber) return apiResponse.result.billNumber;
  } catch {
    return null;
  }

  return null;
}

export default function SubmissionSuccessModal({
  isOpen,
  submissionId,
  apiResponse,
  workflowExecutionId,
  onClose,
  onSubmitAnother
}: SubmissionSuccessModalProps) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(10);
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (countdown === 0 && isOpen) {
      onClose();
    }
  }, [countdown, isOpen, onClose]);

  if (!isOpen) return null;

  const billNumber = getBillNumber(apiResponse);
  const confirmationNumber = apiResponse?.confirmationNumber || apiResponse?.orderId || apiResponse?.id || submissionId.slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Order Submitted Successfully!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Your order has been received and is being processed
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {billNumber && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Bill #</span>
                <Hash className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              </div>
              <p className="text-xl font-mono font-bold text-blue-600 dark:text-blue-400">
                {billNumber}
              </p>
            </div>
          )}

          {!billNumber && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Confirmation Number</span>
                <FileText className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100">
                {confirmationNumber}
              </p>
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Submission ID</span>
              <Clock className="h-4 w-4 text-gray-400" />
            </div>
            <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
              {submissionId}
            </p>
          </div>

          {workflowExecutionId && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                  Automated Workflow Started
                </span>
                <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                Your order is being processed through the automated workflow
              </p>
            </div>
          )}

          {apiResponse?.message && (
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {apiResponse.message}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={onSubmitAnother}
            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
          >
            Submit Another Order
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
          >
            Close {countdown > 0 && `(${countdown}s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
