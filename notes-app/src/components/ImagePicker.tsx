import { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { IconButton } from './IconButton';

interface ImagePickerProps {
  onImageSelect: (images: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}

export function ImagePicker({ onImageSelect, multiple = false, disabled = false }: ImagePickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect if device is mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isMobileDevice || (isTouchDevice && window.innerWidth < 1024));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onImageSelect(files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  return (
    <div className="flex gap-1">
      {/* Take Photo Button - Only on Mobile */}
      {isMobile && (
        <>
          <IconButton
            icon={Camera}
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled}
            tooltip="Take Photo"
            variant="primary"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </>
      )}

      {/* Choose Photo Button */}
      <IconButton
        icon={ImageIcon}
        onClick={() => galleryInputRef.current?.click()}
        disabled={disabled}
        tooltip="Choose Photo"
        variant="primary"
      />

      {/* Hidden gallery input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
