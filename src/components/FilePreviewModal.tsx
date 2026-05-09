import { X, Trash2, Download, FileText } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Modal from "./Modal";

export interface Attachment {
  storageId: string;
  name: string;
  type: string;
}

interface FilePreviewModalProps {
  file: Attachment | null;
  isOpen: boolean;
  onClose: () => void;
  onRemove: () => void;
}

export default function FilePreviewModal({ file, isOpen, onClose, onRemove }: FilePreviewModalProps) {
  const url = useQuery(api.files.getUrl, file?.storageId ? { storageId: file.storageId } : "skip");
  
  if (!isOpen || !file) return null;

  const isImage = file.type.startsWith('image/');

  return (
    <Modal isOpen={isOpen} onClose={onClose} zIndex={300} size="4xl">
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] relative">
        {/* Close button overlay */}
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-colors"
          title="Close"
        >
          <X size={20} />
        </button>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex items-center justify-center min-h-[300px] bg-gray-50/50">
           {isImage ? (
             url ? (
               <img src={url} alt={file.name} className="max-w-full max-h-full object-contain" />
             ) : (
               <div className="w-10 h-10 border-4 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" />
             )
           ) : (
             <div className="flex flex-col items-center gap-4 p-12">
               <div className="w-24 h-24 rounded-2xl bg-white shadow-sm border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-primary)]">
                 <FileText size={48} strokeWidth={1.5} />
               </div>
               <div className="text-center">
                 <h3 className="text-lg font-semibold text-[var(--color-ink)] truncate max-w-md">{file.name}</h3>
                 <p className="text-sm text-[var(--color-muted)] uppercase tracking-wider mt-1">{file.type.split('/')[1] || 'File'}</p>
               </div>
             </div>
           )}
        </div>
        
        {/* Footer Menu */}
        <div className="p-4 flex items-center justify-between border-t border-[var(--color-hairline)] bg-white">
          <span className="text-sm font-medium truncate pr-4 text-[var(--color-muted)]">{file.name}</span>
          <div className="flex items-center gap-2">
            {url && (
              <a 
                href={url} 
                download={file.name}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 hover:bg-black/5 rounded-full text-[var(--color-ink)] font-medium transition-colors"
                title="Download"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={20} />
                <span>Download</span>
              </a>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(); onClose(); }}
              className="flex items-center gap-2 px-4 py-2 hover:bg-red-50 rounded-full text-red-500 font-medium transition-colors"
              title="Delete"
            >
              <Trash2 size={20} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
