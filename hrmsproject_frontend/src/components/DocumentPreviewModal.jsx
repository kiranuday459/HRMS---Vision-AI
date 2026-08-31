import React, { useEffect } from 'react';

const DocumentPreviewModal = ({ isOpen, onClose, document }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !document) return null;

  const fileUrl = document.preview;
  const fileName = document.name || document.label || 'Document';
  const fileLabel = document.label || document.name || 'Document';
  const isImage = document.type?.startsWith('image/') || 
    (fileUrl && /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(fileUrl)) ||
    (document.name && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(document.name));
  const isPdf = document.type === 'application/pdf' ||
    (fileUrl && /\.pdf($|\?)/i.test(fileUrl)) ||
    (document.name && /\.pdf$/i.test(document.name));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="absolute inset-0 bg-brand-blue/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative bg-white w-full max-w-4xl rounded-2xl md:rounded-3xl shadow-2xl border border-brand-blue/5 overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-brand-blue-dark px-6 py-4 flex items-center justify-between text-white flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-white/10 rounded-xl flex-shrink-0">
              {isImage ? (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="2" />
                  <polyline points="21 15 16 10 5 21" strokeWidth="2" />
                </svg>
              ) : isPdf ? (
                <svg className="w-5 h-5 text-red-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 8.5h-1v2H7v-6h2.5c1.4 0 2 .8 2 2s-.6 2-2 2zm5 2h-1.5v-6h1.5c1.4 0 2.5 1.1 2.5 2.5v1c0 1.4-1.1 2.5-2.5 2.5zm4.5-4h-2v1.5h1.5v1.5H19v2h-1.5v-6H20v1z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate">{fileLabel}</h3>
              <p className="text-[11px] text-white/60 truncate">
                {document.name ? `${document.name}` : ''}
                {document.size ? ` • ${document.size}` : ''}
                {document.date ? ` • ${document.date}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 text-white transition-all"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-gray-100/50 p-4 md:p-6 overflow-auto flex items-center justify-center min-h-[300px]">
          {isImage ? (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={fileUrl}
                alt={fileLabel}
                className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-md bg-white"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={`${fileUrl}#toolbar=0`}
              className="w-full h-[70vh] rounded-xl border border-gray-200 bg-white shadow-sm"
              title={fileLabel}
            />
          ) : (
            <iframe
              src={fileUrl}
              className="w-full h-[70vh] rounded-xl border border-gray-200 bg-white shadow-sm"
              title={fileLabel}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentPreviewModal;
