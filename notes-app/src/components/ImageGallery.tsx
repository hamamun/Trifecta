import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';

export interface ImageData {
  id: string;
  data: string; // base64
  name: string;
  size: number;
  type: string;
  addedAt: string;
}

interface ImageGalleryProps {
  images: ImageData[];
  initialIndex?: number;
  onClose: () => void;
  onDelete?: (imageId: string) => void;
  showDelete?: boolean;
}

export function ImageGallery({ images, initialIndex = 0, onClose, onDelete, showDelete = false }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  const currentImage = images[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setZoom(1);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setZoom(1);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentImage.data;
    link.download = currentImage.name;
    link.click();
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.5, 0.5));
  };

  const handleDelete = () => {
    if (onDelete && confirm('Delete this image?')) {
      onDelete(currentImage.id);
      if (images.length === 1) {
        onClose();
      } else if (currentIndex >= images.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors z-10"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Controls */}
      <div className="absolute top-4 left-4 flex gap-2 z-10">
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={handleDownload}
          className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
          title="Download"
        >
          <Download className="w-5 h-5 text-white" />
        </button>
        {showDelete && onDelete && (
          <button
            onClick={handleDelete}
            className="p-2 bg-red-600 bg-opacity-80 hover:bg-opacity-100 rounded-full transition-colors"
            title="Delete"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* Image counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-white bg-opacity-20 rounded-full text-white text-sm z-10">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Previous button */}
      {images.length > 1 && (
        <button
          onClick={goToPrevious}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
        >
          <ChevronLeft className="w-8 h-8 text-white" />
        </button>
      )}

      {/* Image */}
      <div className="max-w-[90vw] max-h-[90vh] overflow-auto">
        <img
          src={currentImage.data}
          alt={currentImage.name}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={goToNext}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
        >
          <ChevronRight className="w-8 h-8 text-white" />
        </button>
      )}

      {/* Image info */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-white bg-opacity-20 rounded-lg text-white text-sm text-center">
        <p className="font-medium">{currentImage.name}</p>
        <p className="text-xs opacity-80">{(currentImage.size / 1024).toFixed(1)} KB</p>
      </div>
    </div>
  );
}
